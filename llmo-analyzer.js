// LLMO Universal Analyzer for Screaming Frog with Gemini API by metehan.ai (Metehan Yesilyurt)
// Automatically detects target queries and scores pages for LLM optimization / EXPERIMENTAL - USE WITH CAUTION
// Replace with your actual Gemini API key
const apiKey = 'xx-xx';

// Configuration
const CONFIG = {
  MAX_PASSAGES: 100, // You can adjust this.
  MIN_WORDS: 10,
  MAX_CHUNK_LENGTH: 500,
  API_TEMPERATURE: 0.2,
  MAX_OUTPUT_TOKENS: 4096
};

// Extract comprehensive page content for LLMO analysis
function extractLLMOContent() {
  const content = {
    url: window.location.href,
    title: document.title || '',
    meta_description: document.querySelector('meta[name="description"]')?.content || '',
    passages: [],
    schema: [],
    stats: {
      word_count: 0,
      h1_count: 0,
      h2_count: 0,
      p_count: 0,
      list_count: 0
    }
  };

  // Priority 1: Title and Meta
  if (content.title) {
    content.passages.push({
      type: 'title',
      text: content.title,
      position: 'header',
      weight: 2.0
    });
  }

  if (content.meta_description) {
    content.passages.push({
      type: 'meta_description',
      text: content.meta_description,
      position: 'header',
      weight: 1.8
    });
  }

  // Priority 2: H1 tags //Ideally, there is only one H1 in the page as the title, but it can be different from the <title> tag. I left this because there are many complex scenarios; you can just make the weight 0.001 or something else and move on.
  const h1s = document.querySelectorAll('h1');
  h1s.forEach((h1, idx) => {
    const text = h1.textContent.trim();
    if (text && text.split(' ').length >= 3) {
      content.passages.push({
        type: 'h1',
        text: text,
        position: `h1_${idx}`,
        weight: 1.7
      });
      content.stats.h1_count++;
    }
  });

  // Priority 3: H2 headings with their content sections
  const h2s = document.querySelectorAll('h2');
  h2s.forEach((h2, idx) => {
    const headingText = h2.textContent.trim();
    if (headingText) {
      // Get the heading
      content.passages.push({
        type: 'h2',
        text: headingText,
        position: `h2_${idx}`,
        weight: 1.5
      });
      content.stats.h2_count++;

      // Get content after this H2 until next H2
      let sibling = h2.nextElementSibling;
      let sectionContent = '';
      
      while (sibling && !['H1', 'H2'].includes(sibling.tagName)) {
        if (sibling.tagName === 'P' || sibling.tagName === 'UL' || sibling.tagName === 'OL') {
          sectionContent += ' ' + sibling.textContent;
        }
        sibling = sibling.nextElementSibling;
      }

      if (sectionContent.trim() && sectionContent.split(' ').length >= CONFIG.MIN_WORDS) {
        content.passages.push({
          type: 'h2_content',
          text: sectionContent.trim().substring(0, CONFIG.MAX_CHUNK_LENGTH),
          position: `h2_content_${idx}`,
          weight: 1.3
        });
      }
    }
  });

  // Priority 4: First 3 paragraphs (above the fold)
  const paragraphs = document.querySelectorAll('p');
  let pCount = 0;
  paragraphs.forEach((p, idx) => {
    const text = p.textContent.trim();
    if (text && text.split(' ').length >= CONFIG.MIN_WORDS && pCount < 3) {
      content.passages.push({
        type: 'paragraph_primary',
        text: text.substring(0, CONFIG.MAX_CHUNK_LENGTH),
        position: `p_${idx}`,
        weight: idx < 3 ? 1.4 : 1.0
      });
      pCount++;
    }
    content.stats.p_count++;
  });

  // Priority 5: Lists (often contain key information)
  const lists = document.querySelectorAll('ul, ol');
  lists.forEach((list, idx) => {
    if (idx < 5) {
      const items = Array.from(list.children)
        .map(li => li.textContent.trim())
        .filter(text => text.length > 20);
      
      if (items.length > 0) {
        content.passages.push({
          type: 'list',
          text: items.join(' | ').substring(0, CONFIG.MAX_CHUNK_LENGTH),
          position: `list_${idx}`,
          weight: 1.1
        });
        content.stats.list_count++;
      }
    }
  });

  // Priority 6: Schema.org structured data
  const schemas = document.querySelectorAll('script[type="application/ld+json"]');
  schemas.forEach(schema => {
    try {
      const data = JSON.parse(schema.textContent);
      content.schema.push(data);
      
      // Extract key schema information
      if (data.description) {
        content.passages.push({
          type: 'schema_description',
          text: data.description,
          position: 'schema',
          weight: 1.5
        });
      }
      
      if (data.name) {
        content.passages.push({
          type: 'schema_name',
          text: data.name,
          position: 'schema',
          weight: 1.6
        });
      }
    } catch (e) {}
  });

  // Priority 7: FAQ sections (high LLM value)
  const faqContainers = document.querySelectorAll('[itemtype*="FAQPage"], .faq, #faq, [class*="faq"]');
  faqContainers.forEach((container, idx) => {
    const questions = container.querySelectorAll('[itemprop="name"], .question, h3, h4');
    const answers = container.querySelectorAll('[itemprop="text"], .answer, p');
    
    questions.forEach((q, qIdx) => {
      if (qIdx < answers.length) {
        content.passages.push({
          type: 'faq',
          text: `Q: ${q.textContent.trim()} A: ${answers[qIdx].textContent.trim()}`.substring(0, CONFIG.MAX_CHUNK_LENGTH),
          position: `faq_${idx}_${qIdx}`,
          weight: 1.6
        });
      }
    });
  });

  // Calculate total word count
  content.stats.word_count = document.body.textContent.split(/\s+/).filter(word => word.length > 0).length;

  // Limit passages
  content.passages = content.passages.slice(0, CONFIG.MAX_PASSAGES);

  return content;
}

// Detect content type from various signals
function detectContentType(content) {
  const url = window.location.href.toLowerCase();
  const bodyText = document.body.textContent.toLowerCase();
  
  // Check schema first
  for (let schema of content.schema) {
    if (schema['@type']) {
      if (schema['@type'].includes('Product')) return 'product';
      if (schema['@type'].includes('Article')) return 'article';
      if (schema['@type'].includes('HowTo')) return 'technical';
      if (schema['@type'].includes('FAQPage')) return 'faq';
      if (schema['@type'].includes('LocalBusiness')) return 'local';
    }
  }
  
  // URL patterns
  if (/\/(product|shop|item|buy)/.test(url)) return 'product';
  if (/\/(blog|article|news|post)/.test(url)) return 'article';
  if (/\/(docs?|documentation|guide|tutorial|how-to)/.test(url)) return 'technical';
  if (/\/(category|categories|collection)/.test(url)) return 'category';
  if (/\/(faq|questions|help)/.test(url)) return 'faq';
  
  // Content patterns
  if (/price|add to cart|buy now|\$\d+/.test(bodyText)) return 'product';
  if (/published|author|posted on|reading time/.test(bodyText)) return 'article';
  if (/step \d|tutorial|guide|how to|instructions/.test(bodyText)) return 'technical';
  
  return 'general';
}

try {
  const content = extractLLMOContent();
  const contentType = detectContentType(content);

  // Create comprehensive LLMO analysis prompt
  const prompt = `You are an expert LLM Optimization (LLMO) analyst. Analyze this webpage to determine how well it would perform in LLM-based search systems like Google's SGE, ChatGPT, and Perplexity.

URL: ${content.url}
Content Type: ${contentType}
Word Count: ${content.stats.word_count}

PAGE CONTENT PASSAGES:
${JSON.stringify(content.passages, null, 2)}

STRUCTURED DATA:
${content.schema.length > 0 ? JSON.stringify(content.schema, null, 2) : 'None'}

Perform the following analysis:

1. IDENTIFY TARGET QUERIES:
Based on the content, what are the 5-10 most likely search queries that this page could rank for in LLM systems? Consider:
- Primary topic queries
- Long-tail variations
- Question-based queries
- Comparison queries
- How-to queries (if applicable)

2. LLMO SCORING:
For EACH identified query, score the page's content (0-5 scale):
- 5: Perfectly answers the query with comprehensive information
- 4: Strong answer with minor gaps
- 3: Decent coverage but missing key details
- 2: Partially relevant
- 1: Barely relevant
- 0: Not relevant

3. PASSAGE-LEVEL ANALYSIS:
Identify which passages best answer each query and why.

4. CONTENT GAPS:
What information is missing that LLMs would expect for these queries?

5. OPTIMIZATION RECOMMENDATIONS:
Specific, actionable recommendations to improve LLMO performance.

OUTPUT FORMAT (JSON):
{
  "primary_topic": "main topic/entity",
  "target_queries": [
    {
      "query": "example query",
      "relevance_score": 4.5,
      "best_passages": ["title", "h2_0"],
      "coverage": "strong"
    }
  ],
  "overall_llmo_score": 3.8,
  "top3_potential": "yes/no",
  "ranking_potential": "low/medium/high",
  "priority": "low/medium/high/critical",
  "content_gaps": [
    "Missing comparison with alternatives",
    "No pricing information"
  ],
  "recommendations": [
    "Add comprehensive FAQ section",
    "Include step-by-step instructions"
  ],
  "quality_signals": {
    "has_schema": true,
    "good_structure": true,
    "comprehensive": false,
    "answers_questions": true
  }
}`;

  // Call Gemini API
  const requestData = {
    contents: [{
      parts: [{
        text: prompt
      }]
    }],
    generationConfig: {
      temperature: CONFIG.API_TEMPERATURE,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: CONFIG.MAX_OUTPUT_TOKENS,
      responseMimeType: "application/json"
    }
  };

  const xhr = new XMLHttpRequest();
  xhr.open('POST', `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, false);
  xhr.setRequestHeader('Content-Type', 'application/json');

  xhr.send(JSON.stringify(requestData));

  if (xhr.status === 200) {
    const response = JSON.parse(xhr.responseText);

    if (response.candidates && response.candidates[0] && response.candidates[0].content) {
      const analysisText = response.candidates[0].content.parts[0].text;
      
      try {
        const analysis = JSON.parse(analysisText);
        
        // Format output for Screaming Frog
        let output = '=== LLMO ANALYSIS RESULTS ===\n\n';
        
        // Overall metrics
        output += `OVERALL LLMO SCORE: ${analysis.overall_llmo_score}/5\n`;
        output += `TOP 3 POTENTIAL: ${analysis.top3_potential}\n`;
        output += `RANKING POTENTIAL: ${analysis.ranking_potential}\n`;
        output += `OPTIMIZATION PRIORITY: ${analysis.priority}\n\n`;
        
        // Target queries and scores
        output += '=== TARGET QUERIES & SCORES ===\n';
        analysis.target_queries.forEach((q, idx) => {
          output += `${idx + 1}. "${q.query}" - Score: ${q.relevance_score}/5 (${q.coverage})\n`;
        });
        
        // Content gaps
        output += '\n=== CONTENT GAPS ===\n';
        analysis.content_gaps.forEach((gap, idx) => {
          output += `${idx + 1}. ${gap}\n`;
        });
        
        // Recommendations
        output += '\n=== OPTIMIZATION RECOMMENDATIONS ===\n';
        analysis.recommendations.forEach((rec, idx) => {
          output += `${idx + 1}. ${rec}\n`;
        });
        
        // Page statistics
        output += '\n=== PAGE STATISTICS ===\n';
        output += `• Word Count: ${content.stats.word_count}\n`;
        output += `• H1 Tags: ${content.stats.h1_count}\n`;
        output += `• H2 Tags: ${content.stats.h2_count}\n`;
        output += `• Paragraphs: ${content.stats.p_count}\n`;
        output += `• Lists: ${content.stats.list_count}\n`;
        output += `• Schema.org: ${content.schema.length > 0 ? 'Yes' : 'No'}\n`;
        output += `• Content Type: ${contentType}\n`;
        output += `• Passages Analyzed: ${content.passages.length}\n`;
        
        // Quality signals
        output += '\n=== QUALITY SIGNALS ===\n';
        Object.entries(analysis.quality_signals).forEach(([key, value]) => {
          output += `• ${key}: ${value}\n`;
        });
        
        // Store raw JSON for custom extractions
        output += `\n\n=== RAW JSON DATA ===\n${analysisText}`;
        
        return seoSpider.data(output);
        
      } catch (parseError) {
        // If JSON parsing fails, return the raw response
        return seoSpider.data('=== LLMO ANALYSIS (RAW) ===\n\n' + analysisText);
      }
    } else {
      return seoSpider.error('Invalid Gemini API response structure');
    }
  } else {
    const errorBody = xhr.responseText;
    return seoSpider.error(`API Error ${xhr.status}: ${errorBody}`);
  }
} catch (error) {
  return seoSpider.error(`Script Error: ${error.toString()}`);
}
