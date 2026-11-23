import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUserSession } from "@/00_lib/session";
import { saveUploadedFile, type UploadCategory } from "@/00_lib/uploadStorage";

const ALLOWED_USER_CATEGORIES: ReadonlySet<UploadCategory> = new Set([
  "reviews",
  "inquiries",
  "dogs",
  "daily",
]);

/**
 * 사용자 전용 파일 업로드 API (후기 사진 / 1:1 문의 미디어 / 반려견 프로필 사진 / 일상 사진)
 * - WAGGLE_APP_SESSION 검증 전용 (관리자는 /admin/api/upload 사용)
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUserSession();
  if (!user) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다." }, { status: 401 });
  }

  const rawCat = request.nextUrl.searchParams.get("category") ?? "inquiries";
  const category: UploadCategory = ALLOWED_USER_CATEGORIES.has(rawCat as UploadCategory)
    ? (rawCat as UploadCategory)
    : "inquiries";

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "파일이 첨부되지 않았습니다." }, { status: 400 });
  }

  try {
    const saved = await saveUploadedFile(file, category);
    return NextResponse.json({
      ok: true,
      data: { url: saved.url, name: file.name, size: saved.size },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UPLOAD_FAILED";
    if (code === "FILE_TOO_LARGE") {
      return NextResponse.json(
        {
          ok: false,
          error:
            category === "inquiries"
              ? "영상은 50MB, 이미지는 15MB 이하만 업로드할 수 있습니다. 대용량 영상은 YouTube 링크를 이용해 주세요."
              : "이미지는 15MB 이하만 업로드할 수 있습니다.",
        },
        { status: 400 },
      );
    }
    if (code === "INVALID_IMAGE") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "유효한 이미지 파일(JPG, PNG, WebP)만 업로드할 수 있습니다. 아이폰 HEIC 사진은 JPEG로 변환 후 시도해 주세요.",
        },
        { status: 400 },
      );
    }
    if (code === "INVALID_VIDEO") {
      return NextResponse.json(
        { ok: false, error: "유효한 영상 파일(MP4, MOV, WebM)만 업로드할 수 있습니다." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "파일 업로드 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
