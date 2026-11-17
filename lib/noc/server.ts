import "server-only";
import data from "../data/noc-2021.json";
import { matchNoc, type NocData, type NocMatch } from "../engine/noc/match";

export const NOC = data as NocData;

export function suggestNoc(duties: string, title = "", limit = 5): NocMatch {
  return matchNoc(NOC, duties.slice(0, 6000), title.slice(0, 200), limit);
}
