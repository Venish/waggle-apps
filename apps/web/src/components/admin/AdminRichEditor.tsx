"use client";

import { useRef, useState } from "react";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import {
  normalizeHtmlCanonicalUploads,
  rewriteHtmlForAdminUploads,
  toAdminUploadUrl,
} from "@/00_lib/mediaUrl";
import { uploadMediaFile } from "@/00_lib/uploadClient";
import { useAdminAlertStore } from "@/01_store/admin/useAdminAlertStore";

interface AdminRichEditorProps {
  name: string;
  initialHtml?: string | null;
  placeholder?: string;
}

export function AdminRichEditor({
  name,
  initialHtml,
  placeholder = "상품 상세 설명, 급여/사용 방법, 주의사항과 상세 이미지를 자유롭게 작성하세요.",
}: AdminRichEditorProps) {
  const [html, setHtml] = useState(normalizeHtmlCanonicalUploads(initialHtml));
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const openAlert = useAdminAlertStore((s) => s.openAlert);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
    ],
    content: rewriteHtmlForAdminUploads(initialHtml),
    editorProps: {
      attributes: {
        class:
          "admin-prose min-h-64 max-h-[34rem] overflow-y-auto px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      setHtml(normalizeHtmlCanonicalUploads(ed.getHTML()));
    },
  });

  const handleUploadImage = async (file: File) => {
    if (!editor) return;
    setUploading(true);
    try {
      const result = await uploadMediaFile("/admin/api/upload?category=editor", file);
      if (!result.ok) {
        openAlert({
          title: "이미지 업로드 실패",
          description: result.error,
          tone: "negative",
        });
        return;
      }
      editor.chain().focus().setImage({ src: toAdminUploadUrl(result.url), alt: file.name }).run();
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toolBtn = (active: boolean) =>
    `inline-flex size-7 items-center justify-center rounded-btn-sm transition-colors ${
      active
        ? "bg-inverse text-on-inverse"
        : "text-secondary hover:bg-[var(--mix-hover-subtle)] hover:text-neutral"
    }`;

  return (
    <div className="overflow-hidden rounded-control bg-base-1 atlas-border">
      <input type="hidden" name={name} value={html} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleUploadImage(f);
        }}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 bg-base-2 px-2 py-1.5 atlas-border-b">
        <button
          type="button"
          title="제목 2"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={toolBtn(Boolean(editor?.isActive("heading", { level: 2 })))}
        >
          <Heading2 className="size-3.5" />
        </button>
        <button
          type="button"
          title="제목 3"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          className={toolBtn(Boolean(editor?.isActive("heading", { level: 3 })))}
        >
          <Heading3 className="size-3.5" />
        </button>

        <span className="mx-1 h-4 w-px bg-hairline" />

        <button
          type="button"
          title="굵게"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={toolBtn(Boolean(editor?.isActive("bold")))}
        >
          <Bold className="size-3.5" />
        </button>
        <button
          type="button"
          title="기울임"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={toolBtn(Boolean(editor?.isActive("italic")))}
        >
          <Italic className="size-3.5" />
        </button>
        <button
          type="button"
          title="밑줄"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleUnderline().run()}
          className={toolBtn(Boolean(editor?.isActive("underline")))}
        >
          <UnderlineIcon className="size-3.5" />
        </button>

        <span className="mx-1 h-4 w-px bg-hairline" />

        <button
          type="button"
          title="글머리 목록"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={toolBtn(Boolean(editor?.isActive("bulletList")))}
        >
          <List className="size-3.5" />
        </button>
        <button
          type="button"
          title="번호 목록"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          className={toolBtn(Boolean(editor?.isActive("orderedList")))}
        >
          <ListOrdered className="size-3.5" />
        </button>
        <button
          type="button"
          title="인용구"
          disabled={!editor}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          className={toolBtn(Boolean(editor?.isActive("blockquote")))}
        >
          <Quote className="size-3.5" />
        </button>
        <button
          type="button"
          title="구분선"
          disabled={!editor}
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
          className={toolBtn(false)}
        >
          <Minus className="size-3.5" />
        </button>

        <span className="mx-1 h-4 w-px bg-hairline" />

        <button
          type="button"
          title="왼쪽 정렬"
          disabled={!editor}
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
          className={toolBtn(Boolean(editor?.isActive({ textAlign: "left" })))}
        >
          <AlignLeft className="size-3.5" />
        </button>
        <button
          type="button"
          title="가운데 정렬"
          disabled={!editor}
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
          className={toolBtn(Boolean(editor?.isActive({ textAlign: "center" })))}
        >
          <AlignCenter className="size-3.5" />
        </button>
        <button
          type="button"
          title="오른쪽 정렬"
          disabled={!editor}
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
          className={toolBtn(Boolean(editor?.isActive({ textAlign: "right" })))}
        >
          <AlignRight className="size-3.5" />
        </button>

        <span className="mx-1 h-4 w-px bg-hairline" />

        <button
          type="button"
          disabled={!editor || uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-7 items-center gap-1 rounded-btn-sm px-2 text-xs font-medium text-neutral transition-colors hover:bg-[var(--mix-hover-subtle)] atlas-border disabled:opacity-50"
        >
          <ImagePlus className="size-3.5" />
          {uploading ? "업로드 중..." : "이미지 삽입"}
        </button>

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            title="실행 취소"
            disabled={!editor || !editor.can().undo()}
            onClick={() => editor?.chain().focus().undo().run()}
            className="inline-flex size-7 items-center justify-center rounded-btn-sm text-secondary hover:bg-[var(--mix-hover-subtle)] disabled:opacity-35"
          >
            <Undo2 className="size-3.5" />
          </button>
          <button
            type="button"
            title="다시 실행"
            disabled={!editor || !editor.can().redo()}
            onClick={() => editor?.chain().focus().redo().run()}
            className="inline-flex size-7 items-center justify-center rounded-btn-sm text-secondary hover:bg-[var(--mix-hover-subtle)] disabled:opacity-35"
          >
            <Redo2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="relative bg-base-1">
        {!editor && (
          <div className="min-h-64 px-4 py-3 text-xs text-subdued">{placeholder}</div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
