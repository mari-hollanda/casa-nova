import { describe, expect, it } from "vitest";
import { allocateByLargestRemainder, centsToInput, parseBRLToCents } from "./money";

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe("allocateByLargestRemainder", () => {
  it("distribui a sobra pelo maior resto e fecha o total exato", () => {
    // 100 / 3 partes iguais: 33,33,33 + 1 centavo para o menor índice
    expect(allocateByLargestRemainder(100, [1, 1, 1])).toEqual([34, 33, 33]);
  });

  it("respeita a proporção dos pesos", () => {
    expect(allocateByLargestRemainder(1000, [1, 3])).toEqual([250, 750]);
  });

  it("dá a sobra a quem tem o maior resto, não ao primeiro", () => {
    // 10 * [1,1,8]/10 → 1,1,8 exato; 7 * [5,3,2]/10 → 3.5,2.1,1.4 → restos .5,.1,.4
    expect(allocateByLargestRemainder(7, [5, 3, 2])).toEqual([4, 2, 1]);
  });

  it("aceita total negativo (desconto) mantendo a soma exata", () => {
    const result = allocateByLargestRemainder(-100, [1, 1, 1]);
    expect(result).toEqual([-34, -33, -33]);
    expect(sum(result)).toBe(-100);
  });

  it("total zero resulta em zeros", () => {
    expect(allocateByLargestRemainder(0, [5, 7])).toEqual([0, 0]);
  });

  it("pesos todos zero dividem igualmente", () => {
    expect(allocateByLargestRemainder(10, [0, 0])).toEqual([5, 5]);
  });

  it("linha com peso zero não recebe nada quando há outras com peso", () => {
    expect(allocateByLargestRemainder(100, [0, 1])).toEqual([0, 100]);
  });

  it("rejeita pesos inválidos e destinatários ausentes", () => {
    expect(() => allocateByLargestRemainder(10, [-1, 2])).toThrow();
    expect(() => allocateByLargestRemainder(10, [])).toThrow();
    expect(() => allocateByLargestRemainder(1.5, [1])).toThrow();
  });

  it("não perde precisão com valores grandes", () => {
    const total = 9_007_199_254_740_000;
    const result = allocateByLargestRemainder(total, [3_000_000_000, 7_000_000_000, 1]);
    expect(sum(result)).toBe(total);
  });

  it("a soma é sempre exata em casos aleatórios", () => {
    let seed = 42;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648);
    for (let n = 0; n < 500; n++) {
      const weights = Array.from({ length: 1 + (rand() % 6) }, () => rand() % 100000);
      const total = (rand() % 2_000_000) - 1_000_000;
      expect(sum(allocateByLargestRemainder(total, weights))).toBe(total);
    }
  });
});

describe("centsToInput", () => {
  it("é o inverso de parseBRLToCents", () => {
    for (const cents of [0, 5, 99, 100, 123456, 100_000_000]) {
      expect(parseBRLToCents(centsToInput(cents))).toBe(cents);
    }
    expect(centsToInput(1250)).toBe("12,50");
  });
});

describe("parseBRLToCents", () => {
  it.each([
    ["12", 1200],
    ["12,5", 1250],
    ["12,50", 1250],
    ["1.234,56", 123456],
    ["R$ 9,90", 990],
    ["0,05", 5],
  ])("converte %s", (input, expected) => {
    expect(parseBRLToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "1,234", "-5", "1.23", "12,345", "1..2"])("rejeita %s", (input) => {
    expect(parseBRLToCents(input)).toBeNull();
  });
});
