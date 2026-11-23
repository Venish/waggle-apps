import "server-only";
import sanitizeHtml from "sanitize-html";

/**
 * 관리자 리치 에디터(Tiptap) 상품 상세 HTML 서버측 XSS 새니타이저
 * - 허용 태그/속성 화이트리스트만 통과 (script, iframe, on* 핸들러, javascript: URL 원천 제거)
 */
export function sanitizeProductDetailHtml(dirty: string | null | undefined): string | null {
  if (!dirty) return null;
  const trimmed = dirty.trim();
  if (!trimmed) return null;

  const clean = sanitizeHtml(trimmed, {
    allowedTags: [
      "h2",
      "h3",
      "h4",
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "ul",
      "ol",
      "li",
      "blockquote",
      "hr",
      "img",
      "a",
      "span",
    ],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      h4: ["style"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(left|center|right)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  }).trim();

  // 빈 에디터 기본값 (<p></p>)은 null로 정규화
  const textOnly = clean.replace(/<[^>]*>/g, "").trim();
  if (!textOnly && !clean.includes("<img")) {
    return null;
  }
  return clean;
}
