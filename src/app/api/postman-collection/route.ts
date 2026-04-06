import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Read the Postman collection file
    const collectionPath = path.join(process.cwd(), 'analytics', 'docs', 'MCP_API_Postman_Collection.json');
    const collectionData = fs.readFileSync(collectionPath, 'utf8');
    
    // Parse and return the collection
    const collection = JSON.parse(collectionData);
    
    return new NextResponse(JSON.stringify(collection, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="Knotie-AI-Pro-MCP-API.postman_collection.json"',
      },
    });
  } catch (error) {
    console.error('Error serving Postman collection:', error);
    return NextResponse.json(
      { error: 'Failed to load Postman collection' },
      { status: 500 }
    );
  }
}
