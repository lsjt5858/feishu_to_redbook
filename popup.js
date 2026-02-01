// 飞书到小红书格式转换器
class FeishuToXiaohongshuConverter {
  constructor() {
    this.emojis = {
      title: ['✨', '🌟', '💫', '⭐️', '🎯'],
      section: ['📌', '💡', '🔥', '👉', '✅'],
      highlight: ['⚡️', '💪', '🎉', '🌈', '💖']
    };
  }

  convert(content) {
    if (!content || content.trim() === '') {
      return '';
    }

    let result = '';
    const lines = content.split('\n').filter(line => line.trim());
    
    // 处理标题
    if (lines.length > 0) {
      const titleEmoji = this.getRandomEmoji('title');
      result += `${titleEmoji} ${lines[0].trim()} ${titleEmoji}\n\n`;
      lines.shift();
    }

    // 处理内容段落
    let inList = false;
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      // 检测列表项
      if (line.match(/^[•·\-\*]\s/) || line.match(/^\d+[\.\)]\s/)) {
        if (!inList) {
          result += '\n';
          inList = true;
        }
        const emoji = this.getRandomEmoji('section');
        result += `${emoji} ${line.replace(/^[•·\-\*\d+\.\)]\s*/, '')}\n`;
      } else {
        inList = false;
        result += `${line}\n\n`;
      }
    }

    // 添加小红书风格结尾
    result += this.addXiaohongshuEnding();

    return result.trim();
  }

  getRandomEmoji(type) {
    const emojiList = this.emojis[type] || this.emojis.highlight;
    return emojiList[Math.floor(Math.random() * emojiList.length)];
  }

  addXiaohongshuEnding() {
    const endings = [
      '\n\n✨ 喜欢的话记得点赞收藏哦～',
      '\n\n💖 觉得有用的话给个小心心吧',
      '\n\n🌟 有问题欢迎评论区交流～',
      '\n\n⭐️ 关注我，分享更多干货内容'
    ];
    return endings[Math.floor(Math.random() * endings.length)];
  }
}

// 主逻辑
document.addEventListener('DOMContentLoaded', function() {
  const convertBtn = document.getElementById('convertBtn');
  const copyBtn = document.getElementById('copyBtn');
  const preview = document.getElementById('preview');
  const status = document.getElementById('status');
  const logs = document.getElementById('logs');
  const converter = new FeishuToXiaohongshuConverter();

  // 日志函数
  function log(message) {
    const timestamp = new Date().toLocaleTimeString();
    const logMessage = `[${timestamp}] ${message}\n`;
    logs.value += logMessage;
    logs.scrollTop = logs.scrollHeight;
    console.log(message);
  }

  // 转换按钮
  convertBtn.addEventListener('click', async () => {
    logs.value = ''; // 清空日志
    log('开始转换流程...');
    
    try {
      convertBtn.disabled = true;
      showStatus('正在提取内容...', 'success');

      log('获取当前标签页信息...');
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      log(`当前页面URL: ${tab.url}`);
      
      // 检查是否在飞书页面
      const isFeishuPage = tab.url.includes('feishu.cn') || 
                          tab.url.includes('larksuite.com') || 
                          tab.url.includes('feishu.com') ||
                          tab.url.includes('larkoffice.com');
      
      log(`是否为飞书页面: ${isFeishuPage}`);
      
      if (!isFeishuPage) {
        log('错误：不是飞书页面');
        showStatus('请在飞书文档页面中使用此插件', 'error');
        convertBtn.disabled = false;
        return;
      }

      // 先滚动页面加载所有内容
      log('开始滚动页面加载内容...');
      showStatus('正在加载完整内容...', 'success');
      
      const scrollResult = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrollToLoadAll
      });
      log(`滚动完成，结果: ${JSON.stringify(scrollResult)}`);

      // 等待内容加载
      log('等待1秒让内容完全加载...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 注入脚本提取内容
      log('开始提取页面内容...');
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractFeishuContent
      });

      log(`提取结果: ${results ? '有结果' : '无结果'}`);
      
      if (!results || !results[0]) {
        log('错误：未能提取到内容 - results为空');
        showStatus('未能提取到内容，请确保页面已完全加载', 'error');
        convertBtn.disabled = false;
        return;
      }

      const resultData = results[0].result;
      log(`结果数据: ${JSON.stringify(resultData)}`);
      
      if (!resultData || !resultData.content) {
        log('错误：未能提取到内容 - content为空');
        showStatus('未能提取到内容，请确保页面已完全加载', 'error');
        convertBtn.disabled = false;
        return;
      }

      const content = resultData.content;
      log(`提取到的内容长度: ${content.length} 字符`);
      log(`使用的选择器: ${resultData.selector}`);
      log(`内容前100字符: ${content.substring(0, 100)}`);
      
      if (content.trim().length < 10) {
        log('错误：提取的内容太少');
        showStatus('提取的内容太少，请检查页面', 'error');
        convertBtn.disabled = false;
        return;
      }

      // 转换格式
      log('开始转换格式...');
      const converted = converter.convert(content);
      log(`转换后的内容长度: ${converted.length} 字符`);
      
      preview.value = converted;
      copyBtn.disabled = false;
      
      log('转换成功！');
      showStatus('转换成功！', 'success');
      convertBtn.disabled = false;

    } catch (error) {
      log(`发生错误: ${error.message}`);
      log(`错误堆栈: ${error.stack}`);
      showStatus('发生错误：' + error.message, 'error');
      convertBtn.disabled = false;
      console.error(error);
    }
  });

  // 复制按钮
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(preview.value);
      showStatus('已复制到剪贴板！', 'success');
      
      const originalText = copyBtn.textContent;
      copyBtn.textContent = '✓ 已复制';
      setTimeout(() => {
        copyBtn.textContent = originalText;
      }, 2000);
    } catch (error) {
      showStatus('复制失败：' + error.message, 'error');
    }
  });

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
    
    if (type === 'success') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    }
  }
});

// 滚动加载所有内容
function scrollToLoadAll() {
  return new Promise((resolve) => {
    let lastHeight = 0;
    let scrollCount = 0;
    const maxScrolls = 50; // 最多滚动50次

    function scroll() {
      // 滚动到底部
      window.scrollTo(0, document.body.scrollHeight);
      scrollCount++;

      setTimeout(() => {
        const currentHeight = document.body.scrollHeight;
        
        // 如果高度不再变化或达到最大滚动次数，说明已经加载完成
        if (currentHeight === lastHeight || scrollCount >= maxScrolls) {
          // 滚回顶部
          window.scrollTo(0, 0);
          resolve();
        } else {
          lastHeight = currentHeight;
          scroll();
        }
      }, 200); // 每次滚动间隔200ms
    }

    scroll();
  });
}

// 在页面中执行的提取函数
function extractFeishuContent() {
  console.log('开始提取飞书内容...');
  
  // 尝试多种选择器
  const selectors = [
    '[class*="docx-render"]',
    '[class*="doc-render"]',
    '.doc-content',
    '.lark-doc-content',
    '[class*="wiki-content"]',
    '[data-testid="doc-content"]',
    '.editor-content',
    'article',
    '[role="article"]',
    '[role="main"]',
    '.document-content',
    '[class*="article"]',
    '[class*="editor"]',
    'main'
  ];

  let content = '';
  let foundSelector = '';
  
  for (const selector of selectors) {
    console.log(`尝试选择器: ${selector}`);
    const element = document.querySelector(selector);
    if (element) {
      const text = element.innerText || element.textContent || '';
      console.log(`找到元素，文本长度: ${text.length}`);
      if (text.trim().length > 50) {
        content = text;
        foundSelector = selector;
        console.log(`使用选择器: ${selector}`);
        break;
      }
    }
  }

  // 如果还是没找到，尝试获取body的所有文本
  if (!content) {
    console.log('使用选择器都没找到，尝试获取body内容');
    const body = document.body;
    if (body) {
      content = body.innerText || body.textContent || '';
      foundSelector = 'body (fallback)';
    }
  }

  // 清理文本 - 移除常见的UI元素和导航文本
  if (content) {
    // 移除常见的飞书UI文本
    const uiTexts = [
      'ByteDance',
      '最近修改:',
      '文档内容请保持"公开可接受"',
      '分享',
      '编辑',
      '添加图标',
      '添加封面',
      '评论（',
      '反向引用',
      '本文引用',
      '关系图',
      '推荐内容由 AI 生成',
      '真诚点赞，手留余香',
      '上传日志',
      '联系客服',
      '功能更新',
      '帮助中心',
      '效率指南',
      '代码块',
      '取消自动换行',
      '复制',
      '自动换行'
    ];
    
    let lines = content.split('\n');
    lines = lines.filter(line => {
      const trimmed = line.trim();
      // 过滤掉UI文本
      if (uiTexts.some(ui => trimmed.includes(ui))) {
        return false;
      }
      // 过滤掉太短的行（可能是UI元素）
      if (trimmed.length < 2) {
        return false;
      }
      return true;
    });
    
    content = lines.join('\n');
    
    // 清理多余空行和空格
    content = content
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  console.log(`最终提取内容长度: ${content.length}`);
  console.log(`使用的选择器: ${foundSelector}`);
  console.log(`内容前200字符: ${content.substring(0, 200)}`);

  return {
    content: content,
    selector: foundSelector,
    length: content.length
  };
}
