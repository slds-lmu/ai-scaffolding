/** Single import surface for section/concept authors. */
export { registerConcept, getConcept, allConceptIds } from "./registry";
export type { ConceptDef, ConceptId } from "./types";
export { TooltipProvider, ConceptLink } from "./tooltip/TooltipEngine";
export type { TooltipLabels } from "./tooltip/TooltipEngine";
export { ExpandedReading } from "./ExpandedReading";
export { M, MD, Eq, EnvBlock } from "./Math";
export { Proof, PStep } from "./Proof";
export { Quiz, Frage } from "./Quiz";
export { Slider } from "./widgets/Slider";
export { MatrixInput } from "./widgets/MatrixInput";
export { TransformCanvas } from "./widgets/TransformCanvas";
export type { Vec2 } from "./widgets/TransformCanvas";
export { Plot } from "./widgets/Plot";
export type { Series } from "./widgets/Plot";
export { LabeledPlot, LabeledTransformCanvas, niceTicks, sigmaMax, maxAbsCoord } from "./widgets/Axes";
