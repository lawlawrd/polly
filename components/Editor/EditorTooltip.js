import React, { useEffect } from "react";
import { BubbleMenu } from "@tiptap/react";
import { colorTypes } from "./editorUtils.js";

const EditorTooltip = ({
  editor,
  linkActive,
  setLinkActive,
  currentLink,
  setCurrentLink,
  setColorPickerActive,
}) => {
  useEffect(() => {
    if (linkActive && editor.getAttributes("link").href)
      setCurrentLink(editor.getAttributes("link").href);
  }, [linkActive]);

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        onHide: () => {
          setLinkActive(false);
          setCurrentLink("");
        },
      }}
      className={`editor-tooltip panel arrow bottom center ${
        linkActive ? "link-active" : ""
      }`}
    >
      {!linkActive
        ? [
            <button
              key={"editor-tooltip-bold"}
              title="Bold"
              onClick={() => editor.chain().focus().toggleBold().run()}
              disabled={!editor.can().chain().focus().toggleBold().run()}
              className={editor.isActive("bold") ? "active" : ""}
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#bold" />
              </svg>
            </button>,
            <button
              key={"editor-tooltip-italic"}
              title="Italic"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              disabled={!editor.can().chain().focus().toggleItalic().run()}
              className={editor.isActive("italic") ? "active" : ""}
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#italic" />
              </svg>
            </button>,
            <button
              key={"editor-tooltip-underline"}
              title="Underline"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              disabled={!editor.can().chain().focus().toggleUnderline().run()}
              className={editor.isActive("underline") ? "active" : ""}
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#underline" />
              </svg>
            </button>,
            <button
              key={"editor-tooltip-strikethrough"}
              title="Strikethrough"
              onClick={() => editor.chain().focus().toggleStrike().run()}
              disabled={!editor.can().chain().focus().toggleStrike().run()}
              className={editor.isActive("strike") ? "active" : ""}
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#strikethrough" />
              </svg>
            </button>,
            <button
              key={"editor-tooltip-code"}
              title="Code"
              onClick={() => editor.chain().focus().toggleCode().run()}
              disabled={!editor.can().chain().focus().toggleCode().run()}
              className={editor.isActive("code") ? "active" : ""}
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#format-code" />
              </svg>
            </button>,
            <button
              key={"editor-tooltip-link"}
              title="Link"
              onClick={() => setLinkActive(true)}
              className={editor.isActive("link") ? "active" : ""}
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#link" />
              </svg>
            </button>,
            <div className="divider" key="yo" />,
            <button
              key="editor-tooltip-text-color"
              title="Text color"
              onClick={() => setColorPickerActive("text-color")}
              className="color-picker"
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#color-text" />
              </svg>
              <span
                className={`tag current-color ${
                  !editor.getAttributes("textStyle").color ? "nothing" : ""
                }`}
                style={{
                  backgroundColor: editor.getAttributes("textStyle").color,
                }}
              />
            </button>,
            <button
              key={"editor-tooltip-highlight"}
              title="Text color"
              onClick={() => setColorPickerActive("highlight")}
              className="color-picker"
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#color-fill" />
              </svg>
              <span
                className={`tag current-color ${
                  colorTypes.findIndex((c) =>
                    editor.isActive("highlight", { color: c.hex }),
                  ) == -1
                    ? "nothing"
                    : ""
                }`}
                style={{
                  backgroundColor:
                    colorTypes.findIndex((c) =>
                      editor.isActive("highlight", { color: c.hex }),
                    ) == -1
                      ? ""
                      : colorTypes[
                          colorTypes.findIndex((c) =>
                            editor.isActive("highlight", { color: c.hex }),
                          )
                        ].hex,
                }}
              />
            </button>,
            <div className="divider" key="yo2" />,
            <button
              key={"editor-tooltip-unset-all-marks"}
              title="Remove all formatting"
              onClick={() => editor.commands.unsetAllMarks()}
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#clear" />
              </svg>
            </button>,
          ]
        : [
            <button
              key={"editor-tooltip-back"}
              title="Go back"
              onClick={() => setLinkActive(false)}
            >
              <svg className="icon" style={{ transform: "rotate(180deg)" }}>
                <use xlinkHref="/images/icons.svg#arrow-right" />
              </svg>
            </button>,
            <input
              key={"editor-tooltip-input-link"}
              className="editor-tooltip-input-link"
              type="text"
              value={currentLink}
              onChange={(e) => setCurrentLink(e.target.value)}
            />,
            <button
              key={"editor-tooltip-delete-link"}
              title="Remove link"
              className="negative"
              onClick={() => {
                editor
                  .chain()
                  .focus()
                  .extendMarkRange("link")
                  .unsetLink()
                  .run();
                setLinkActive(false);
              }}
            >
              <svg className="icon">
                <use xlinkHref="/images/icons.svg#delete" />
              </svg>
            </button>,
          ]}
    </BubbleMenu>
  );
};

export default EditorTooltip;
