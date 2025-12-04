/**
 * 本地文件解析器
 */

import JSZip from "jszip";
import type { LocalChapter } from "./types";

/**
 * 解析 TXT 文件
 */
export function parseTxt(content: string, fileName: string): {
  title: string;
  author?: string;
  chapters: LocalChapter[];
} {
  // 从文件名提取书名
  const title = fileName.replace(/\.txt$/i, "");

  // 尝试识别章节
  const lines = content.split(/\r?\n/);
  const chapters: LocalChapter[] = [];
  let currentChapter: { title: string; lines: string[] } | null = null;
  let chapterIndex = 0;

  // 章节标题正则（支持多种格式）
  const chapterRegex = /^(?:第[0-9零一二三四五六七八九十百千万]+[章节回集]|Chapter\s*\d+|[0-9]+[\.、])\s*(.*)$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(chapterRegex);
    if (match) {
      // 保存上一章
      if (currentChapter) {
        chapters.push({
          title: currentChapter.title,
          content: currentChapter.lines.join("\n\n"),
          index: chapterIndex++,
        });
      }
      // 开始新章节
      currentChapter = {
        title: trimmed,
        lines: [],
      };
    } else if (currentChapter) {
      // 添加到当前章节
      currentChapter.lines.push(trimmed);
    }
  }

  // 保存最后一章
  if (currentChapter) {
    chapters.push({
      title: currentChapter.title,
      content: currentChapter.lines.join("\n\n"),
      index: chapterIndex++,
    });
  }

  // 如果没有识别到章节，整个文件作为一章
  if (chapters.length === 0) {
    chapters.push({
      title: "正文",
      content: content,
      index: 0,
    });
  }

  return { title, chapters };
}

/**
 * 解析 EPUB 文件
 */
export async function parseEpub(
  arrayBuffer: ArrayBuffer,
  fileName: string
): Promise<{
  title: string;
  author?: string;
  chapters: LocalChapter[];
}> {
  try {
    // 1. 使用 JSZip 解压文件
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 2. 读取 META-INF/container.xml 找到 content.opf 路径
    const containerXml = await zip.file("META-INF/container.xml")?.async("text");
    if (!containerXml) {
      throw new Error("无效的 EPUB 文件：缺少 container.xml");
    }

    const opfPath = extractOpfPath(containerXml);
    if (!opfPath) {
      throw new Error("无法找到 content.opf 文件路径");
    }

    // 3. 读取 content.opf
    const opfContent = await zip.file(opfPath)?.async("text");
    if (!opfContent) {
      throw new Error("无法读取 content.opf 文件");
    }

    // 4. 解析 OPF 获取元数据和章节列表
    const metadata = parseOpfMetadata(opfContent);
    const spine = parseOpfSpine(opfContent);
    const manifest = parseOpfManifest(opfContent);

    // 5. 预加载所有图片为 base64
    const opfDir = opfPath.substring(0, opfPath.lastIndexOf("/") + 1);
    const imageCache = await loadAllImages(zip, opfDir);

    // 6. 根据 spine 顺序读取章节内容
    const chapters: LocalChapter[] = [];
    let chapterIndex = 0;

    for (let i = 0; i < spine.length; i++) {
      const itemId = spine[i];
      if (!itemId) continue;
      const href = manifest[itemId];
      if (!href) continue;

      const chapterPath = resolvePath(opfDir, href);
      const chapterHtml = await zip.file(chapterPath)?.async("text");
      if (!chapterHtml) continue;

      // 获取章节所在目录，用于解析相对路径的图片
      const chapterDir = chapterPath.substring(0, chapterPath.lastIndexOf("/") + 1);

      // 提取章节标题和内容（包含图片）
      const { title: chapterTitle, content } = await extractChapterContentWithImages(
        chapterHtml,
        chapterIndex,
        chapterDir,
        imageCache
      );
      
      if (content.trim()) {
        chapters.push({
          title: chapterTitle || `第 ${chapterIndex + 1} 章`,
          content,
          index: chapterIndex,
        });
        chapterIndex++;
      }
    }

    if (chapters.length === 0) {
      throw new Error("未能解析出任何章节内容");
    }

    return {
      title: metadata.title || fileName.replace(/\.epub$/i, ""),
      author: metadata.author,
      chapters,
    };
  } catch (err) {
    console.error("[parseEpub] 解析失败:", err);
    throw new Error(`EPUB 解析失败: ${err instanceof Error ? err.message : "未知错误"}`);
  }
}

/**
 * 解析路径，处理相对路径
 */
function resolvePath(basePath: string, relativePath: string): string {
  // 处理 URL 编码
  const decodedPath = decodeURIComponent(relativePath);
  
  // 如果是绝对路径，直接返回
  if (decodedPath.startsWith("/")) {
    return decodedPath.substring(1);
  }
  
  // 合并路径
  const parts = (basePath + decodedPath).split("/");
  const resolved: string[] = [];
  
  for (const part of parts) {
    if (part === "..") {
      resolved.pop();
    } else if (part !== "." && part !== "") {
      resolved.push(part);
    }
  }
  
  return resolved.join("/");
}

/**
 * 预加载所有图片为 base64
 */
async function loadAllImages(
  zip: JSZip,
  opfDir: string
): Promise<Map<string, string>> {
  const imageCache = new Map<string, string>();
  const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
  
  const files = Object.keys(zip.files);
  
  for (const filePath of files) {
    const lowerPath = filePath.toLowerCase();
    const isImage = imageExtensions.some((ext) => lowerPath.endsWith(ext));
    
    if (isImage) {
      try {
        const file = zip.file(filePath);
        if (file) {
          const data = await file.async("base64");
          const mimeType = getMimeType(filePath);
          const dataUrl = `data:${mimeType};base64,${data}`;
          
          // 存储多种可能的路径格式
          imageCache.set(filePath, dataUrl);
          imageCache.set("/" + filePath, dataUrl);
          
          // 相对于 OPF 目录的路径
          if (filePath.startsWith(opfDir)) {
            const relativePath = filePath.substring(opfDir.length);
            imageCache.set(relativePath, dataUrl);
          }
        }
      } catch (err) {
        console.warn(`[parseEpub] 加载图片失败: ${filePath}`, err);
      }
    }
  }
  
  return imageCache;
}

/**
 * 根据文件扩展名获取 MIME 类型
 */
function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split(".").pop();
  const mimeTypes: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  };
  return mimeTypes[ext || ""] || "image/jpeg";
}

/**
 * 从 HTML/XHTML 提取章节标题和内容（包含图片）
 */
async function extractChapterContentWithImages(
  html: string,
  index: number,
  chapterDir: string,
  imageCache: Map<string, string>
): Promise<{ title: string; content: string }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  // 尝试提取标题
  let title = "";
  const h1 = doc.querySelector("h1");
  const h2 = doc.querySelector("h2");
  const h3 = doc.querySelector("h3");
  const titleEl = doc.querySelector("title");

  if (h1?.textContent?.trim()) {
    title = h1.textContent.trim();
  } else if (h2?.textContent?.trim()) {
    title = h2.textContent.trim();
  } else if (h3?.textContent?.trim()) {
    title = h3.textContent.trim();
  } else if (titleEl?.textContent?.trim()) {
    title = titleEl.textContent.trim();
  } else {
    title = `第 ${index + 1} 章`;
  }

  // 提取正文内容
  const body = doc.querySelector("body");
  if (!body) {
    return { title, content: "" };
  }

  // 移除脚本和样式标签
  body.querySelectorAll("script, style").forEach((el) => el.remove());

  // 处理图片：将 src 替换为 base64
  const images = body.querySelectorAll("img");
  images.forEach((img) => {
    const src = img.getAttribute("src");
    if (src) {
      const base64 = resolveImageSrc(src, chapterDir, imageCache);
      if (base64) {
        img.setAttribute("src", base64);
      }
    }
  });

  // 处理 SVG image 标签（xlink:href）
  const svgImages = body.querySelectorAll("image");
  svgImages.forEach((img) => {
    const href = img.getAttribute("xlink:href") || img.getAttribute("href");
    if (href) {
      const base64 = resolveImageSrc(href, chapterDir, imageCache);
      if (base64) {
        img.setAttribute("xlink:href", base64);
        img.setAttribute("href", base64);
      }
    }
  });

  // 构建 HTML 内容
  const contentParts: string[] = [];
  
  // 遍历 body 的子元素
  for (const child of Array.from(body.children)) {
    const tagName = child.tagName.toLowerCase();
    
    // 跳过已提取的标题
    if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
      continue;
    }
    
    // 处理图片
    if (tagName === "img") {
      const src = child.getAttribute("src");
      if (src) {
        contentParts.push(`<p class="epub-image"><img src="${src}" style="max-width: 100%; height: auto;" /></p>`);
      }
      continue;
    }
    
    // 处理 SVG
    if (tagName === "svg") {
      contentParts.push(`<p class="epub-image">${child.outerHTML}</p>`);
      continue;
    }
    
    // 处理包含图片的元素
    const innerImages = child.querySelectorAll("img, svg");
    if (innerImages.length > 0) {
      // 保留整个 HTML 结构
      contentParts.push(child.outerHTML);
      continue;
    }
    
    // 处理纯文本段落
    const text = child.textContent?.trim();
    if (text) {
      contentParts.push(`<p>${text}</p>`);
    }
  }

  // 如果没有提取到内容，尝试直接获取 body 的 innerHTML
  if (contentParts.length === 0) {
    const innerHTML = body.innerHTML.trim();
    if (innerHTML) {
      return { title, content: innerHTML };
    }
  }

  return { title, content: contentParts.join("\n") };
}

/**
 * 解析图片路径并返回 base64
 */
function resolveImageSrc(
  src: string,
  chapterDir: string,
  imageCache: Map<string, string>
): string | null {
  // 如果已经是 data URL，直接返回
  if (src.startsWith("data:")) {
    return src;
  }
  
  // 尝试多种路径格式
  const pathsToTry = [
    src,
    resolvePath(chapterDir, src),
    decodeURIComponent(src),
    resolvePath(chapterDir, decodeURIComponent(src)),
  ];
  
  for (const path of pathsToTry) {
    const base64 = imageCache.get(path);
    if (base64) {
      return base64;
    }
  }
  
  console.warn(`[parseEpub] 未找到图片: ${src}`);
  return null;
}

/**
 * 从 container.xml 提取 OPF 文件路径
 */
function extractOpfPath(containerXml: string): string | null {
  const match = containerXml.match(/full-path="([^"]+)"/);
  return match && match[1] ? match[1] : null;
}

/**
 * 解析 OPF 元数据
 */
function parseOpfMetadata(opfContent: string): { title?: string; author?: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opfContent, "text/xml");

  const titleEl = doc.querySelector("metadata title, dc\\:title");
  const authorEl = doc.querySelector("metadata creator, dc\\:creator");

  return {
    title: titleEl?.textContent?.trim() || undefined,
    author: authorEl?.textContent?.trim() || undefined,
  };
}

/**
 * 解析 OPF spine（章节顺序）
 */
function parseOpfSpine(opfContent: string): string[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opfContent, "text/xml");

  const itemrefs = doc.querySelectorAll("spine itemref");
  const spine: string[] = [];

  itemrefs.forEach((itemref) => {
    const idref = itemref.getAttribute("idref");
    if (idref) {
      spine.push(idref);
    }
  });

  return spine;
}

/**
 * 解析 OPF manifest（文件映射）
 */
function parseOpfManifest(opfContent: string): Record<string, string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(opfContent, "text/xml");

  const items = doc.querySelectorAll("manifest item");
  const manifest: Record<string, string> = {};

  items.forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) {
      manifest[id] = href;
    }
  });

  return manifest;
}



/**
 * 生成书籍 ID
 */
export function generateLocalBookId(fileName: string): string {
  return `local:${Date.now()}:${fileName}`;
}
