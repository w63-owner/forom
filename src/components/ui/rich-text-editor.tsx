"use client"

import { useEffect } from "react"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import Underline from "@tiptap/extension-underline"
import Placeholder from "@tiptap/extension-placeholder"
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
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "",
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[8rem] rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:prose-invert",
      },
    },
  })

  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() === value) return
    editor.commands.setContent(value, false)
  }, [editor, value])

  if (!editor) return null

  const toggleLink = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined
    const url = window.prompt("URL du lien", previousUrl ?? "")
    if (url === null) return
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
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
          onClick={toggleLink}
          className={cn(
            "rounded-md border border-input px-2 py-1 text-xs",
            editor.isActive("link") && "bg-muted"
          )}
        >
          Lien
        </button>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}
