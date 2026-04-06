/**
 * AI Translation Service for Partner Custom Texts
 * 
 * This service translates partner custom texts into all supported languages
 * using Azure OpenAI and stores the results in the database.
 */

import { getLanguageOptions } from '@/lib/languages';
import { logger } from '../logger';

export interface TranslatableTexts {
  portalTitle?: string;
  portalSlogan?: string;
  voiceAiAgentPricingNote?: string;
  voiceAiAgentSpecialOffer?: string;
  supportEmail?: string;
  companyAddress?: string;
  companyPhone?: string;
  characterName?: string;
  features?: string; // JSON string
  testimonials?: string; // JSON string
  faqs?: string; // JSON string
  trustIndicators?: string; // JSON string
}

export interface TranslationResult {
  success: boolean;
  translations?: Record<string, TranslatableTexts>;
  error?: string;
  creditsUsed?: number;
}

export class TranslationService {
  private static readonly TRANSLATION_COST_CREDITS = 8; // 8 Knotie credits per translation request
  private static readonly AZURE_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
  private static readonly AZURE_API_KEY = process.env.AZURE_OPENAI_API_KEY;
  private static readonly DEPLOYMENT_NAME = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o-mini';

  /**
   * Translate all partner custom texts into supported languages
   */
  static async translatePartnerTexts(
    partnerId: string,
    texts: TranslatableTexts,
    businessName: string
  ): Promise<TranslationResult> {
    try {
      // Validate Azure OpenAI configuration
      if (!this.AZURE_ENDPOINT || !this.AZURE_API_KEY) {
        throw new Error('Azure OpenAI not configured');
      }

      // Get supported languages (excluding English as source)
      const languageOptions = getLanguageOptions();
      const targetLanguages = languageOptions.filter(lang => lang.value !== 'en');

      // Prepare texts for translation (filter out empty values)
      const textsToTranslate = Object.entries(texts)
        .filter(([_, value]) => value && value.trim())
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      if (Object.keys(textsToTranslate).length === 0) {
        return {
          success: false,
          error: 'No texts provided for translation'
        };
      }

      // Note: Credit check is handled at API route level

      // Translate to each target language
      const translations: Record<string, TranslatableTexts> = {};
      
      for (const language of targetLanguages) {
        const translatedTexts = await this.translateToLanguage(
          textsToTranslate,
          language.value,
          language.label,
          businessName
        );
        translations[language.value] = translatedTexts;
      }

      // Deduct credits after successful translation
      await this.deductTranslationCredits(partnerId);

      return {
        success: true,
        translations,
        creditsUsed: this.TRANSLATION_COST_CREDITS
      };

    } catch (error) {
      logger.error('Translation service error', error as Error, {
        operation: 'translation_service',
        partnerId
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Translation failed'
      };
    }
  }

  /**
   * Translate texts to a specific language using Azure OpenAI
   */
  private static async translateToLanguage(
    texts: Record<string, string>,
    languageCode: string,
    languageName: string,
    businessName: string
  ): Promise<TranslatableTexts> {
    const prompt = this.buildTranslationPrompt(texts, languageName, businessName);

    const response = await fetch(
      `${this.AZURE_ENDPOINT}/openai/deployments/${this.DEPLOYMENT_NAME}/chat/completions?api-version=2024-02-15-preview`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.AZURE_API_KEY!,
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You are a professional translator specializing in business and marketing content. Translate the provided texts accurately while maintaining their marketing tone and business context.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.1,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Azure OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const translatedContent = data.choices[0]?.message?.content;

    if (!translatedContent) {
      throw new Error('No translation received from Azure OpenAI');
    }

    // Parse the JSON response
    try {
      return JSON.parse(translatedContent);
    } catch (parseError) {
      logger.error('Failed to parse translation response', new Error('Invalid JSON response'), {
        operation: 'translation_service',
        translatedContent,
        languageCode,
        languageName
      });
      throw new Error('Invalid translation response format');
    }
  }

  /**
   * Build translation prompt for Azure OpenAI
   */
  private static buildTranslationPrompt(
    texts: Record<string, string>,
    languageName: string,
    businessName: string
  ): string {
    return `Translate the following business texts to ${languageName}. 

Business Context: This is for "${businessName}", a voice AI technology company.

IMPORTANT INSTRUCTIONS:
1. Maintain professional business tone
2. Keep marketing appeal and persuasive language
3. Preserve any JSON structure for features, testimonials, faqs, and trustIndicators
4. For JSON fields, translate the content within but keep the structure intact
5. Replace {brandName} placeholders with the actual business name where appropriate
6. Return ONLY valid JSON in the exact same structure as input

Input texts to translate:
${JSON.stringify(texts, null, 2)}

Return the translations in the exact same JSON structure with translated values:`;
  }



  /**
   * Deduct credits for translation service
   */
  private static async deductTranslationCredits(partnerId: string): Promise<void> {
    try {
      // Import prisma here to avoid circular dependencies
      const { prisma } = await import('@/lib/prisma');

      // Deduct credits from partner balance
      await prisma.partner.update({
        where: { id: partnerId },
        data: {
          creditBalance: {
            decrement: this.TRANSLATION_COST_CREDITS
          },
          totalCreditsUsed: {
            increment: this.TRANSLATION_COST_CREDITS
          }
        }
      });

      // Get updated balance for transaction record
      const updatedPartner = await prisma.partner.findUnique({
        where: { id: partnerId },
        select: { creditBalance: true }
      });

      // Create credit transaction record with new decimal fields
      await prisma.creditTransaction.create({
        data: {
          partnerId,
          type: 'usage',
          amount: -Math.round(this.TRANSLATION_COST_CREDITS), // Legacy field: rounded integer (negative for deduction)
          amountDecimal: -this.TRANSLATION_COST_CREDITS, // New field: exact decimal value (negative for deduction)
          balanceAfter: Math.round(updatedPartner?.creditBalance || 0), // Legacy field: rounded integer
          balanceAfterDecimal: updatedPartner?.creditBalance || 0, // New field: exact decimal value
          description: 'AI Translation Service - Custom Text Translation'
        }
      });
    } catch (error) {
      logger.error('Error deducting translation credits', error as Error, {
        operation: 'translation_service',
        partnerId,
        creditsToDeduct: this.TRANSLATION_COST_CREDITS
      });
      // Don't throw error here to avoid failing the translation after it's completed
    }
  }

  /**
   * Get translation cost in credits
   */
  static getTranslationCost(): number {
    return this.TRANSLATION_COST_CREDITS;
  }
}
