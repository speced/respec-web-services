declare module "webref" {
  /** A file in `(ed|tr)/dfns/{file}.json` */
  export interface DfnsJSON {
    series: string;
    spec: string;
    url: string;
    dfns: Definition[];
  }

  export interface Definition {
    id: string;
    href: string;
    linkingText: string[];
    localLinkingText: string[];
    type: string;
    for: string[];
    access: "private" | "public";
    informative: boolean;
    heading: Record<string, string>;
    definedIn: string;
  }

  interface SpecVersion {
    url: string;
  }

  /** A file in (ed|tr)/index.json */
  export interface SpecsJSON {
    url: string;
    shortname: string;
    nightly: SpecVersion;
    release?: SpecVersion;
    series: {
      shortname: string;
      currentSpecification: string;
    };
    title: string;
    dfns?: string;
  }
}
