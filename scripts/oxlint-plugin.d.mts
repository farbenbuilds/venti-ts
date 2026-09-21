// Type surface for the local oxlint plugin consumed by the rule tests. The
// implementation is plain JavaScript; only the default export is described.
import type { RuleTester } from "oxlint/plugins-dev";

type Rule = Parameters<RuleTester["run"]>[1];

declare const plugin: {
  readonly meta: { readonly name: string };
  readonly rules: Readonly<Record<string, Rule>>;
};

export default plugin;
