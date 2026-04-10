/**
 * 가락 실시간 경락 응답 `SMALL`과 저장값 비교.
 * 이전에는 숫자 패딩을 넓게 잡아 `01`·`1`·`001` 등이 한데 묶여 **서로 다른 품목** 행이 통과하는 문제가 있었다.
 * 품목이 섞이지 않게 하려면 **trim 후 문자열 완전 일치만** 인정한다. (표기 통일은 DB·저장 단계에서 맞춘다.)
 * @see docs/mafra-openapi-notes.md
 */
export function mafraSmallCodesMatch(expected: string, rowSmall: string): boolean {
  const a = String(expected ?? "").trim();
  const b = String(rowSmall ?? "").trim();
  if (!a || !b) return false;
  return a === b;
}
