// 공급면적 타일 오버플로 회귀 잠금.
// 범위 값(예: 120.81~227.13㎡)이 한 덩어리 nowrap이면 좁은 3열 타일에서 카드 밖으로 잘린다.
// 각 숫자는 nowrap으로 붙여 읽되 물결(~) 앞에서 줄바꿈이 가능하도록 <wbr/>로 분할되어야 한다.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AreaValue } from "../DecisionNoticeCard";

describe("AreaValue 공급면적 렌더링", () => {
  it("범위 값은 물결 앞에서 줄바꿈 가능하도록 <wbr/>로 분할한다", () => {
    const html = renderToStaticMarkup(<AreaValue areas={[120.81, 227.13]} />);
    // 줄바꿈 기회(<wbr/>)가 ㎡·평 두 범위에 각각 존재해야 한다.
    expect(html.match(/<wbr\/?>/g)?.length ?? 0).toBe(2);
    // 숫자는 한 덩어리로 붙은 "120.81~227.13㎡"가 아니라 분할되어 있어야 한다.
    expect(html).not.toContain("120.81~227.13㎡");
    // 값 자체는 보존되어야 한다.
    expect(html).toContain("120.81");
    expect(html).toContain("227.13㎡");
  });

  it("단일 값은 물결 없이 면적·평을 함께 표시한다", () => {
    const html = renderToStaticMarkup(<AreaValue areas={[84.97]} />);
    expect(html).toContain("84.97㎡");
    expect(html).not.toContain("<wbr");
  });

  it("면적이 없으면 아무것도 렌더링하지 않는다", () => {
    expect(renderToStaticMarkup(<AreaValue areas={[]} />)).toBe("");
  });
});
