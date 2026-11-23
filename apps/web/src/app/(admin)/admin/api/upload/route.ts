import { NextResponse, type NextRequest } from "next/server";
import { getCurrentAdminSession } from "@/00_lib/session";
import { saveUploadedFile, type UploadCategory } from "@/00_lib/uploadStorage";

const ADMIN_CATEGORIES: ReadonlySet<UploadCategory> = new Set([
  "products",
  "editor",
  "lessons",
  "inquiries",
]);
const TRAINER_CATEGORIES: ReadonlySet<UploadCategory> = new Set(["inquiries"]);

/**
 * 관리자·훈련사 전용 미디어 업로드 API
 * - ADMIN: 상품 이미지(products), 리치 에디터(editor), 교육 영상(lessons 150MB), Q&A 답변(inquiries 50MB)
 * - TRAINER: 1:1 Q&A 답변 영상/사진(inquiries 50MB)
 * - WAGGLE_ADMIN_SESSION 쿠키가 path="/admin"으로 격리되어 있으므로 반드시 /admin/* 하위에 배치한다.
 */
export async function POST(request: NextRequest) {
  const admin = await getCurrentAdminSession();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const rawCat = request.nextUrl.searchParams.get("category") ?? "products";
  const allowed = admin.role === "ADMIN" ? ADMIN_CATEGORIES : TRAINER_CATEGORIES;
  if (!allowed.has(rawCat as UploadCategory)) {
    return NextResponse.json({ ok: false, error: "허용되지 않은 업로드 권한입니다." }, { status: 403 });
  }
  const category = rawCat as UploadCategory;

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
      const limitMsg =
        category === "lessons"
          ? "교육 영상은 150MB 이하만 업로드할 수 있습니다. 대용량은 YouTube 링크를 이용해 주세요."
          : category === "inquiries"
            ? "영상은 50MB, 이미지는 15MB 이하만 업로드할 수 있습니다."
            : "이미지는 15MB 이하만 업로드할 수 있습니다.";
      return NextResponse.json({ ok: false, error: limitMsg }, { status: 400 });
    }
    if (code === "INVALID_IMAGE") {
      return NextResponse.json(
        { ok: false, error: "유효한 이미지 파일(JPG, PNG, WebP)만 업로드할 수 있습니다." },
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
