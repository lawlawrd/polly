import React, { useEffect, useState } from "react";
import { colorTypes } from "./editorUtils.js";

const rgbToHex = (rgb) => {
  if (!rgb) return "";

  const arr = rgb
    .replace("rgb(", "")
    .replace(")", "")
    .split(", ")
    .map((d) => Number(d));

  return (
    "#" +
    arr
      .map((x) => {
        const hex = x.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
  );
};

const EditorColorPicker = ({
  editor,
  colorPickerActive,
  setColorPickerActive,
}) => {
  const [activeColor, setActiveColor] = useState(false);

  useEffect(() => {
    if (colorPickerActive && colorPickerActive == "text-color") {
      setActiveColor(rgbToHex(editor.getAttributes("textStyle").color));
    } else if (colorPickerActive && colorPickerActive == "highlight") {
      setActiveColor(
        colorTypes.findIndex((c) =>
          editor.isActive("highlight", { color: c.hex }),
        ) == -1
          ? false
          : colorTypes[
              colorTypes.findIndex((c) =>
                editor.isActive("highlight", { color: c.hex }),
              )
            ].hex,
      );
    } else {
      setActiveColor(false);
    }
  }, [colorPickerActive]);

  const setColor = (color) => {
    if (colorPickerActive && colorPickerActive == "text-color")
      editor.chain().focus().setColor(color).run();
    if (colorPickerActive && colorPickerActive == "highlight")
      editor.chain().focus().toggleHighlight({ color }).run();
    if (colorPickerActive && colorPickerActive == "cell-color") {
      editor.chain().focus().setCellAttribute("backgroundColor", color).run();
    }

    setColorPickerActive(false);
  };

  const unsetColor = () => {
    if (colorPickerActive && colorPickerActive == "text-color")
      editor.chain().focus().unsetColor().run();
    if (colorPickerActive && colorPickerActive == "highlight")
      editor.chain().focus().unsetHighlight().run();
    if (colorPickerActive && colorPickerActive == "cell-color")
      editor
        .chain()
        .focus()
        .setCellAttribute("backgroundColor", "transparent")
        .run();

    setColorPickerActive(false);
  };

  return [
    <dialog
      className="editor-color-picker"
      key="dialog"
      open={colorPickerActive && colorPickerActive.length > 0}
    >
      <a
        className="control close"
        tabIndex="0"
        onClick={() => setColorPickerActive(false)}
      >
        <svg className="icon">
          <use xlinkHref="/images/icons.svg#clear"></use>
        </svg>
      </a>
      <header>
        Set{" "}
        <em>
          text
          {colorPickerActive == "highlight" ? " background " : " "}
        </em>
        color:
      </header>
      <div className="color-grid">
        {colorTypes.map((c, i) => (
          <a
            key={"color-picker-" + i}
            className={`tag ${activeColor == c.hex ? "active" : ""}`}
            tabIndex="0"
            role="button"
            onClick={() => setColor(c.hex)}
            style={{ backgroundColor: c.hex, color: c.text }}
          >
            {c.name.charAt(0).toUpperCase() + c.name.slice(1)}
          </a>
        ))}
        <a
          className="tag nothing"
          tabIndex="0"
          role="button"
          onClick={() => unsetColor()}
        >
          No color
        </a>
      </div>
    </dialog>,
    <div
      key="color-picker-backdrop"
      className="backdrop"
      style={{
        zIndex: 100148,
        display:
          colorPickerActive && colorPickerActive.length > 0 ? "block" : "none",
      }}
      onClick={() => setColorPickerActive(false)}
    />,
  ];
};

export default EditorColorPicker;
