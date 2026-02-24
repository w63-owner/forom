"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Placeholder from "@tiptap/extension-placeholder"
import Underline from "@tiptap/extension-underline"
import { cn } from "@/lib/utils"

type Props = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className,
}: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: false }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
        showOnlyWhenEditable: true,
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[8rem] bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:prose-invert [&_h2]:mt-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:text-lg [&_h3]:font-semibold [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/50 [&_blockquote]:pl-3 [&_blockquote]:italic [&_a]:text-primary [&_a]:underline",
        "data-placeholder": placeholder ?? "",
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() === value) return
    editor.commands.setContent(value, { emitUpdate: false })
  }, [editor, value])

  if (!editor) return null

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("URL", previousUrl ?? "")
    if (url === null) return
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm font-medium text-foreground">Description</p>
      <div className="rounded-md border border-input p-2">
        <div className="flex flex-wrap items-center gap-2 border-b border-input pb-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn(
            "rounded-md border border-input px-2 py-1 text-xs font-semibold",
            editor.isActive("bold") && "bg-muted"
          )}
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn(
            "rounded-md border border-input px-2 py-1 text-xs italic",
            editor.isActive("italic") && "bg-muted"
          )}
        >
          I
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn(
            "rounded-md border border-input px-2 py-1 text-xs underline",
            editor.isActive("underline") && "bg-muted"
          )}
        >
          U
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn(
            "rounded-md border border-input px-2 py-1 text-xs",
            editor.isActive("heading", { level: 2 }) && "bg-muted"
          )}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={cn(
            "rounded-md border border-input px-2 py-1 text-xs",
            editor.isActive("heading", { level: 3 }) && "bg-muted"
          )}
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            "rounded-md border border-input px-2 py-1 text-xs",
            editor.isActive("bulletList") && "bg-muted"
          )}
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            "rounded-md border border-input px-2 py-1 text-xs",
            editor.isActive("orderedList") && "bg-muted"
          )}
        >
          1. List
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            "rounded-md border border-input px-2 py-1 text-xs",
            editor.isActive("blockquote") && "bg-muted"
          )}
        >
          “ Quote
        </button>
        <button
          type="button"
          onClick={setLink}
          className={cn(
            "rounded-md border border-input px-2 py-1 text-xs",
            editor.isActive("link") && "bg-muted"
          )}
        >
          Lien
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className="rounded-md border border-input px-2 py-1 text-xs"
        >
          Unlink
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          className="rounded-md border border-input px-2 py-1 text-xs"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          className="rounded-md border border-input px-2 py-1 text-xs"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          className="rounded-md border border-input px-2 py-1 text-xs"
        >
          Redo
        </button>
        </div>
        <div className="pt-2">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}