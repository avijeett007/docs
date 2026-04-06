declare module '*.mdx' {
  const MDXComponent: (props: any) => JSX.Element;
  export default MDXComponent;
}

declare module '*/content/blog/*.mdx' {
  const MDXComponent: (props: any) => JSX.Element;
  export default MDXComponent;
}
