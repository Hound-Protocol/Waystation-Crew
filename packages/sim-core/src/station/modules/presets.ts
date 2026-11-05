import { Shapes, type Blueprint } from "../blueprint";

export type ModuleKind = "arrivals" | "command" | "medical" | "security" | "engineering" | "supply" | "galley" | "habitation";

/**
 * Module presets: organic shapes, authored as code on a Canvas. Coordinates are inside the shape (0,0 = top-left of its
 * bounding box). The door is always at the bottom centre and its approach is kept clear. Items placed on non-floor cells
 * are ignored, so outlines can change without breaking a layout.
 */
export const PRESETS: Record<ModuleKind, Array<() => Blueprint>> = {
  command: [
    () => { const c = Shapes.ellipse(17, 15); c.fill(5, 4, 11, 9, "r").put(8, 1, "n").sym("C", [5, 1], [3, 3], [2, 5]).put(8, 6, "O").sym("Q", [4, 10]).sym("P", [2, 10], [3, 12]).sym("L", [6, 12]); return c.edge("RSLR").done(); },
    () => { const c = Shapes.octagon(17, 15, 4).hline(5, 11, 1, "C", 2).put(8, 2, "n").put(8, 7, "t").pts("o", [6, 7], [10, 7], [8, 5], [8, 9]).sym("e", [2, 6]).sym("S", [3, 2]).sym("P", [2, 11]).sym("L", [4, 12]); return c.edge("RSLR").done(); },
    () => { const c = Shapes.cross(17, 17, 7, 7).put(8, 8, "O").fill(6, 6, 10, 10, "r").vline(8, 1, 4, "C", 2).sym("C", [2, 7], [2, 9]).sym("n", [1, 8]).sym("P", [4, 4]).sym("T", [14, 6]); return c.edge("RSLR").done(); },
    () => { const c = Shapes.hexa(17, 13).hline(4, 12, 1, "C", 2).put(8, 3, "T").pts("o", [7, 4], [9, 4]).sym("s", [3, 4]).sym("m", [2, 6]).fill(5, 6, 11, 8, "r").put(8, 7, "O").sym("Y", [3, 9]); return c.edge("RSLR").done(); },
    () => { const c = Shapes.blob(17, 15, 1.2).sym("C", [4, 2], [3, 4]).put(8, 2, "n").put(8, 6, "t").pts("o", [7, 6], [9, 6], [8, 5], [8, 7]).sym("Q", [3, 8]).sym("P", [3, 10]).sym("S", [5, 12]).put(8, 9, "r"); return c.edge("RSLR").done(); },
  ],
  medical: [
    () => { const c = Shapes.ellipse(17, 15).fill(3, 2, 13, 2, "B", 2).fill(3, 5, 13, 5, "B", 2).sym("m", [5, 9]).put(8, 8, "+").sym("M", [2, 9]).sym("F", [3, 11]).sym("P", [1, 7]); return c.edge("aFNi").done(); },
    () => { const c = Shapes.octagon(15, 15, 4).fill(5, 4, 9, 6, "+").put(7, 5, "B").sym("m", [4, 3]).sym("M", [3, 5]).sym("B", [2, 8], [2, 10], [3, 6]).sym("F", [4, 11]).sym("N", [5, 2]); return c.edge("aFNi").done(); },
    () => { const c = Shapes.cross(17, 17, 7, 7).sym("B", [1, 6], [1, 10], [2, 8]).vline(8, 1, 6, "B", 2).sym("m", [6, 5]).sym("Z", [4, 4]).sym("P", [14, 14]).put(8, 8, "+"); return c.edge("aFNi").done(); },
    () => { const c = Shapes.blob(17, 13, 2.1).fill(3, 2, 13, 2, "z", 2).sym("m", [4, 5]).fill(4, 8, 12, 8, "B", 2).sym("M", [3, 6]).sym("Y", [2, 10]).put(8, 5, "+").sym("F", [6, 10]); return c.edge("aFNi").done(); },
    () => { const c = Shapes.lshape(15, 15, 5, 5).fill(2, 6, 12, 6, "B", 2).fill(2, 9, 12, 9, "B", 2).sym("m", [4, 3]).sym("M", [3, 12]).sym("F", [11, 12]).put(4, 2, "N").sym("P", [1, 12]); return c.edge("aFNi").done(); },
  ],
  security: [
    () => { const c = Shapes.octagon(17, 15, 3).fill(2, 1, 14, 1, "J", 4).fill(2, 2, 14, 2, "B", 4).hline(2, 14, 3, "J", 4).sym("s", [5, 7]).put(8, 7, "s").fill(3, 8, 13, 8, "h", 2).sym("L", [3, 11]).sym("S", [5, 11]).put(8, 9, "T"); return c.edge("LwSq").done(); },
    () => { const c = Shapes.hexa(17, 13).hline(4, 12, 1, "s", 2).put(8, 3, "T").sym("T", [4, 5]).pts("o", [7, 3], [9, 3]).sym("L", [2, 5]).sym("S", [3, 8]).sym("J", [3, 2]).sym("B", [3, 3]); return c.edge("LwSq").done(); },
    () => { const c = Shapes.cross(17, 17, 7, 7).sym("s", [6, 4], [4, 6]).sym("L", [2, 7], [2, 9]).sym("S", [1, 8]).put(8, 8, "T").sym("o", [7, 8]).sym("J", [5, 1]).sym("B", [5, 2]).fill(7, 12, 9, 12, "h"); return c.edge("LwSq").done(); },
    () => { const c = Shapes.blob(15, 15, 0.4).sym("s", [4, 3]).put(7, 2, "s").hline(3, 11, 6, "h", 2).sym("T", [4, 8]).sym("L", [2, 10]).sym("J", [2, 4]).sym("B", [2, 5]).put(7, 8, "t"); return c.edge("LwSq").done(); },
    () => { const c = Shapes.ellipse(15, 13).sym("s", [4, 2], [3, 4]).put(7, 2, "s").sym("S", [2, 7]).sym("L", [3, 9]).fill(4, 6, 10, 6, "=", 2).sym("T", [5, 8]).sym("J", [4, 1]); return c.edge("LwSq").done(); },
  ],
  engineering: [
    () => { const c = Shapes.octagon(17, 15, 4).put(8, 6, "E").sym("e", [4, 3], [3, 6]).sym("U", [3, 9], [3, 10]).sym("I", [6, 3]).sym("G", [2, 8]).sym("W", [5, 11]).sym("h", [6, 6]).sym("X", [11, 2]); return c.edge("IfGUR").done(); },
    () => { const c = Shapes.cross(17, 17, 7, 7).put(8, 8, "E").sym("e", [6, 3], [7, 2]).sym("G", [2, 7]).sym("U", [1, 8]).sym("I", [4, 4]).sym("W", [6, 13]).sym("X", [14, 14]).sym("h", [7, 6]); return c.edge("IfGUR").done(); },
    () => { const c = Shapes.ellipse(17, 13).fill(2, 2, 14, 2, "e", 3).sym("W", [3, 5]).sym("G", [2, 8]).sym("U", [6, 4]).put(8, 6, "T").sym("I", [3, 10]).sym("L", [5, 10]).sym("X", [13, 7]); return c.edge("IfGUR").done(); },
    () => { const c = Shapes.lshape(17, 15, 6, 6).hline(2, 14, 7, "e", 3).sym("U", [2, 9], [2, 10]).sym("G", [3, 12]).put(10, 3, "E").sym("W", [5, 2]).sym("I", [4, 5]).sym("L", [13, 12]); return c.edge("IfGUR").done(); },
    () => { const c = Shapes.blob(17, 15, 2.6).put(8, 5, "E").sym("e", [5, 3], [4, 8]).sym("G", [3, 5]).sym("U", [3, 10]).sym("W", [6, 11]).sym("I", [5, 2]).sym("X", [12, 11]).sym("h", [6, 8]); return c.edge("IfGUR").done(); },
  ],
  supply: [
    () => { const c = Shapes.hexa(17, 15).fill(3, 2, 13, 3, "X", 2, 1).fill(2, 6, 14, 6, "S", 3).sym("k", [4, 9]).sym("C", [2, 8]).sym("L", [3, 11]).sym("h", [7, 8]).sym("=", [6, 11]); return c.edge("SXLS").done(); },
    () => { const c = Shapes.octagon(17, 15, 3).fill(2, 2, 14, 2, "X", 3).fill(2, 5, 14, 5, "S", 4).sym("C", [3, 8]).put(8, 8, "k").sym("X", [3, 10]).sym("L", [5, 11]).fill(5, 7, 11, 7, "^", 3); return c.edge("SXLS").done(); },
    () => { const c = Shapes.cross(17, 17, 9, 7).sym("X", [2, 7], [2, 9], [3, 8]).sym("S", [5, 2]).sym("S", [5, 14]).put(8, 8, "k").sym("C", [6, 6]).sym("h", [4, 4]).sym("L", [6, 12]); return c.edge("SXLS").done(); },
    () => { const c = Shapes.ellipse(17, 13).fill(3, 2, 13, 2, "S", 2).fill(3, 5, 13, 5, "X", 2).sym("C", [4, 8]).sym("k", [2, 6]).sym("W", [5, 10]).sym("L", [3, 10]).sym("h", [7, 8]); return c.edge("SXLS").done(); },
    () => { const c = Shapes.blob(17, 15, 3.3).fill(3, 3, 13, 3, "X", 2).fill(3, 6, 13, 6, "S", 2).sym("C", [4, 9]).put(8, 9, "k").sym("L", [2, 11]).sym("N", [12, 12]).sym("^", [6, 11]); return c.edge("SXLS").done(); },
  ],
  galley: [
    () => { const c = Shapes.ellipse(17, 15).fill(3, 1, 13, 1, "K", 2).sym("&", [5, 1]).sym("F", [3, 2]).fill(3, 5, 13, 5, "T", 5).fill(3, 8, 13, 8, "T", 5).sym("o", [3, 6], [3, 9]).sym("V", [2, 11]).sym("%", [4, 12]).sym("C", [7, 1]).put(8, 3, "C").sym("P", [1, 7]); return c.edge("KF&S").done(); },
    () => { const c = Shapes.octagon(17, 15, 4).hline(5, 11, 1, "K", 1).put(8, 1, "&").sym("F", [5, 2]).fill(4, 5, 12, 5, "t", 4).fill(4, 8, 12, 8, "t", 4).sym("V", [3, 11]).sym("P", [3, 3]).sym("%", [5, 11]).sym("C", [4, 2]).put(8, 3, "C"); return c.edge("KF&S").done(); },
    () => { const c = Shapes.blob(17, 15, 4.1).fill(3, 2, 13, 2, "K", 1).pts(".", [5, 2], [11, 2]).sym("&", [4, 1]).put(8, 2, "C").hline(3, 13, 6, "T", 2).hline(3, 13, 9, "T", 2).sym("Q", [2, 8]).sym("V", [3, 11]).sym("Y", [2, 4]).sym("F", [4, 3]).sym("C", [3, 5]); return c.edge("KF&S").done(); },
    () => { const c = Shapes.hexa(17, 13).sym("K", [4, 1], [5, 1]).sym("&", [3, 2]).sym("F", [6, 1]).fill(3, 5, 13, 5, "T", 2).fill(3, 8, 13, 8, "T", 2).sym("o", [4, 6]).sym("V", [2, 10]).sym("C", [7, 1]).put(8, 3, "C"); return c.edge("KF&S").done(); },
    () => { const c = Shapes.cross(17, 17, 9, 9).fill(5, 2, 11, 2, "K", 1).sym("&", [6, 2]).sym("F", [5, 3]).fill(5, 6, 11, 6, "t", 3).fill(5, 10, 11, 10, "t", 3).sym("H", [2, 8]).sym("Y", [14, 8]).sym("V", [4, 14]).sym("%", [6, 14]).sym("C", [7, 2]).put(8, 3, "C"); return c.edge("KF&S").done(); },
  ],
  habitation: [
    () => { const c = Shapes.octagon(17, 17, 4).fill(3, 3, 13, 3, "b", 2).fill(3, 5, 13, 5, "b", 2).fill(3, 8, 13, 8, "b", 2).fill(3, 10, 13, 10, "b", 2).fill(4, 12, 12, 12, "b", 2).sym("P", [2, 7]).sym("L", [2, 13]).sym("r", [7, 7]); return c.edge("LPS").done(); },
    () => { const c = Shapes.ellipse(17, 17).fill(4, 2, 12, 2, "B", 2).fill(2, 4, 14, 4, "B", 2).fill(2, 7, 14, 7, "B", 2).fill(2, 10, 14, 10, "B", 2).fill(4, 13, 12, 13, "B", 2).sym("Y", [1, 8]).sym("L", [4, 14]).put(8, 9, "r"); return c.edge("LPS").done(); },
    () => { const c = Shapes.blob(17, 17, 0.9).fill(3, 3, 13, 3, "z", 2).fill(3, 6, 13, 6, "z", 2).fill(3, 9, 13, 9, "z", 2).fill(4, 12, 12, 12, "z", 2).fill(3, 14, 13, 14, "z", 2).sym("P", [1, 8]).sym("Q", [4, 14]).sym("L", [3, 14]); return c.edge("LPS").done(); },
    () => { const c = Shapes.cross(17, 17, 9, 9).fill(5, 1, 11, 2, "b", 2, 1).fill(1, 5, 3, 11, "B", 2, 2).fill(13, 5, 15, 11, "B", 2, 2).fill(5, 14, 11, 15, "b", 2, 1).put(8, 8, "t").pts("o", [7, 8], [9, 8], [8, 7], [8, 9]).sym("P", [5, 5]); return c.edge("LPS").done(); },
    () => { const c = Shapes.hexa(17, 15).fill(3, 2, 13, 2, "B", 2).fill(2, 4, 14, 4, "B", 2).fill(2, 7, 14, 7, "B", 2).fill(3, 10, 13, 10, "B", 2).sym("Q", [3, 12]).sym("%", [5, 12]).sym("H", [1, 9]).put(8, 6, "r").sym("Y", [3, 6]); return c.edge("LPS").done(); },
  ],
  arrivals: [
    () => { const c = Shapes.ellipse(19, 15).airlocks(5, 13).fill(4, 3, 14, 3, "k", 5).fill(3, 6, 15, 6, "Q", 6).sym("N", [2, 9]).sym("P", [3, 11]).sym("V", [5, 12]).put(9, 9, "*").sym("o", [7, 9]); return c.edge("VNPS").done(); },
    () => { const c = Shapes.octagon(17, 15, 4).airlocks(4, 12).hline(5, 11, 3, "k", 3).sym("z", [3, 7]).sym("z", [3, 9]).sym("m", [2, 8]).put(8, 7, "*").sym("N", [4, 11]).sym("Y", [3, 4]).sym("V", [5, 11]); return c.edge("VNPS").done(); },
    () => { const c = Shapes.cross(17, 17, 9, 9).airlocks(5, 11).sym("k", [5, 3]).put(8, 3, "C").put(8, 8, "O").fill(6, 6, 10, 10, "r").sym("Q", [2, 8]).sym("X", [4, 14]).sym("P", [3, 3]).sym("t", [14, 8]); return c.edge("VNPS").done(); },
    () => { const c = Shapes.blob(19, 15, 5.2).airlocks(5, 13).hline(5, 13, 3, "k", 4).sym("Q", [3, 6]).sym("t", [5, 9]).sym("o", [4, 9], [6, 9]).sym("V", [3, 12]).sym("N", [5, 12]).put(9, 7, "*").sym("Y", [2, 4]); return c.edge("VNPS").done(); },
    () => { const c = Shapes.hexa(19, 15).airlocks(5, 13).sym("k", [6, 4]).put(9, 4, "C").sym("J", [3, 7]).sym("T", [4, 9]).sym("z", [2, 8]).put(9, 8, "^").sym("N", [4, 11]).sym("P", [3, 3]); return c.edge("VNPS").done(); },
  ],
};
