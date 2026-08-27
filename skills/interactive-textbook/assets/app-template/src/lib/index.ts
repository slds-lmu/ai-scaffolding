/** Single import surface for section/concept authors. */
export { registerConcept, getConcept, allConceptIds } from "./registry";
export type { ConceptDef, ConceptId } from "./types";
export { TooltipProvider, ConceptLink } from "./tooltip/TooltipEngine";
export type { TooltipLabels } from "./tooltip/TooltipEngine";
export { ExpandedReading } from "./ExpandedReading";
export { Interaktiv } from "./Interaktiv";
export { M, MD, Eq, EnvBlock } from "./Math";
export { Quiz, Frage, QuizLabelsProvider } from "./Quiz";
export type { QuizLabels } from "./Quiz";
export { Slider } from "./widgets/Slider";
export { MatrixInput } from "./widgets/MatrixInput";
export { TransformCanvas } from "./widgets/TransformCanvas";
export type { Vec2 } from "./widgets/TransformCanvas";
export { Plot } from "./widgets/Plot";
export type { PlotPoint, Series } from "./widgets/Plot";
export { LabeledPlot, LabeledTransformCanvas, niceTicks, sigmaMax, maxAbsCoord } from "./widgets/Axes";
export { ConceptFlow } from "./widgets/ConceptFlow";
export type { FlowNode, FlowEdge, FlowGroup } from "./widgets/ConceptFlow";
export { Proof, PStep, ProofLabelsProvider } from "./Proof";
export type { ProofLabels } from "./Proof";
export { FMM_COLORS, fmtDe, fmtEn, makeFmt, fmtInt, clamp, mulberry32, randn, useSeed, fmtTick } from "./widgets/util";
export { MatrixDisplay } from "./widgets/MatrixInput";
export { Zahlfrage } from "./Quiz";
export { ColumnArrows } from "./widgets/TransformCanvas";
export type { Mat2, SubspaceLine } from "./widgets/TransformCanvas";
export { useDrag, svgWorldMapper, clientToUser, ownerSvg, DragHandle } from "./widgets/useDrag";
export type { Punkt, WeltFenster, ZeichenFeld, UseDragOptionen, DragApi } from "./widgets/useDrag";
export { useAnimatedValue, useAnimatedMatrix, easeInOut, linear } from "./widgets/useAnimatedValue";
// Mat2 wird NICHT re-exportiert (TransformCanvas exportiert den Namen bereits;
// die Typen sind strukturell identisch).
export type { Easing } from "./widgets/useAnimatedValue";
export { Verdikt } from "./widgets/Verdikt";
export type { VerdiktArt, VerdiktLabels } from "./widgets/Verdikt";
export { Aufgabe } from "./widgets/Aufgabe";
export { Stepper } from "./widgets/Stepper";
export type { StepperLabels } from "./widgets/Stepper";
export { Schaetzfrage, SchaetzfrageAuswahl } from "./widgets/Schaetzfrage";
export type { SchaetzPhase, SchaetzZustand, SchaetzOption, SchaetzfrageLabels, Schaetzwert } from "./widgets/Schaetzfrage";
export { W_PANEL, W_TEXT, W_MUTED, W_BUTTON, W_BUTTON_AKTIV, W_INPUT } from "./widgets/surface";
export { Surface3D, ViewControls } from "./widgets/Surface3D";
export type { Sicht3D, Flaeche3D, Punkt3D, Pfeil3D, Kurve3D, Ebene3D, Surface3DProps, Vec3 } from "./widgets/Surface3D";

// English aliases (template addition; additive only — the German names above
// are the canonical ones shared with the FMM-Skript lib).
export { Verdikt as Verdict } from "./widgets/Verdikt";
export type { VerdiktArt as VerdictKind, VerdiktLabels as VerdictLabels } from "./widgets/Verdikt";
export { Aufgabe as Task } from "./widgets/Aufgabe";
export { Schaetzfrage as GuessFirst, SchaetzfrageAuswahl as GuessFirstChoice } from "./widgets/Schaetzfrage";
export type {
  SchaetzPhase as GuessPhase,
  SchaetzZustand as GuessState,
  SchaetzOption as GuessOption,
  SchaetzfrageLabels as GuessFirstLabels,
  Schaetzwert as GuessValue,
} from "./widgets/Schaetzfrage";
export { Zahlfrage as NumericQuestion, Frage as Question } from "./Quiz";
export { Interaktiv as Interactive } from "./Interaktiv";
export type { Punkt as Point2, WeltFenster as WorldWindow, ZeichenFeld as DrawArea, UseDragOptionen as UseDragOptions } from "./widgets/useDrag";
