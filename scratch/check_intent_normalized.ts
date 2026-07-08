import "../server/load-env";
import { classifyQueryIntent } from "../server/pipeline/intent-classifier";

const query = "What is the penalty or punishment under the Control of Narcotic Substances Act 1997?";
const intent = classifyQueryIntent(query);
console.log("Original query:", query);
console.log("intent.normalized:", intent.normalized);
console.log("intent.expandedQuery:", intent.expandedQuery);
