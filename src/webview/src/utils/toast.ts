/**
 * 简易 Toast 提示
 */
export function showToast(message: string, duration = 3000): void {
  const containerId = "sidequest-toast-container";
  let container = document.getElementById(containerId);
  if (!container) {
    container = document.createElement("div");
    container.id = containerId;
    container.style.position = "fixed";
    container.style.bottom = "16px";
    container.style.right = "16px";
    container.style.zIndex = "9999";
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.gap = "8px";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.textContent = message;
  toast.style.background = "var(--vscode-inputValidation-errorBackground)";
  toast.style.color = "var(--vscode-inputValidation-errorForeground)";
  toast.style.padding = "8px 12px";
  toast.style.borderRadius = "6px";
  toast.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  toast.style.fontSize = "12px";

  container.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
    if (container && container.childElementCount === 0) {
      container.remove();
    }
  }, duration);
}
