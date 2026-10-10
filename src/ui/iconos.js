// Iconos Phosphor Regular (una sola familia, trazo estándar).
import houseSimple from "@phosphor-icons/core/assets/regular/house-simple.svg?raw";
import table from "@phosphor-icons/core/assets/regular/table.svg?raw";
import chartBar from "@phosphor-icons/core/assets/regular/chart-bar.svg?raw";
import shieldWarning from "@phosphor-icons/core/assets/regular/shield-warning.svg?raw";
import clipboardText from "@phosphor-icons/core/assets/regular/clipboard-text.svg?raw";
import checkCircle from "@phosphor-icons/core/assets/regular/check-circle.svg?raw";
import warning from "@phosphor-icons/core/assets/regular/warning.svg?raw";
import xCircle from "@phosphor-icons/core/assets/regular/x-circle.svg?raw";
import info from "@phosphor-icons/core/assets/regular/info.svg?raw";
import arrowSquareOut from "@phosphor-icons/core/assets/regular/arrow-square-out.svg?raw";
import circleDashed from "@phosphor-icons/core/assets/regular/circle-dashed.svg?raw";
import arrowClockwise from "@phosphor-icons/core/assets/regular/arrow-clockwise.svg?raw";
import caretRight from "@phosphor-icons/core/assets/regular/caret-right.svg?raw";
import play from "@phosphor-icons/core/assets/regular/play.svg?raw";
import stop from "@phosphor-icons/core/assets/regular/stop.svg?raw";
import plus from "@phosphor-icons/core/assets/regular/plus.svg?raw";
import trash from "@phosphor-icons/core/assets/regular/trash.svg?raw";
import question from "@phosphor-icons/core/assets/regular/question.svg?raw";
import fileXls from "@phosphor-icons/core/assets/regular/file-xls.svg?raw";
import copy from "@phosphor-icons/core/assets/regular/copy.svg?raw";
import lightning from "@phosphor-icons/core/assets/regular/lightning.svg?raw";
import diceFive from "@phosphor-icons/core/assets/regular/dice-five.svg?raw";
import target from "@phosphor-icons/core/assets/regular/target.svg?raw";

const SVG = {
  'house-simple': houseSimple,
  'table': table,
  'chart-bar': chartBar,
  'shield-warning': shieldWarning,
  'clipboard-text': clipboardText,
  'check-circle': checkCircle,
  'warning': warning,
  'x-circle': xCircle,
  'info': info,
  'arrow-square-out': arrowSquareOut,
  'circle-dashed': circleDashed,
  'arrow-clockwise': arrowClockwise,
  'caret-right': caretRight,
  'play': play,
  'stop': stop,
  'plus': plus,
  'trash': trash,
  'question': question,
  'file-xls': fileXls,
  'copy': copy,
  'lightning': lightning,
  'dice-five': diceFive,
  'target': target,
};

export const icono = (nombre, etiqueta = '') => `<span class="icon"${etiqueta ? ` role="img" aria-label="${etiqueta}"` : ' aria-hidden="true"'}>${SVG[nombre] || ''}</span>`;

// Estado semántico: icono + palabra, nunca solo color
export const ICONO_NIVEL = { ok: 'check-circle', warn: 'warning', bad: 'x-circle', info: 'info' };
