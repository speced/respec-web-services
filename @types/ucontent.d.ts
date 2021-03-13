declare module "ucontent" {
  type TemplateFunction<T> = (
    template: TemplateStringsArray,
    ...values: unknown[]
  ) => T;

  class UContent extends String {
    public minified: boolean;
    constructor(content: string, minified?: boolean);
    min(): this;
  }
  class CSS extends UContent {}
  class HTML extends UContent {}
  class JS extends UContent {}
  class Raw extends UContent {}
  class SVG extends UContent {}

  export const css: TemplateFunction<CSS>;
  export const html: TemplateFunction<HTML>;
  export const js: TemplateFunction<JS>;
  export const raw: TemplateFunction<Raw>;
  export const svg: TemplateFunction<SVG>;
}
