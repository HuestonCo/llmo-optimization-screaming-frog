// Enhanced LLMO Universal Analyzer for Screaming Frog with Gemini API by Hueston 
// Updated by Hueston.co 

const apiKey = 'YOUR_GEMINI_API_KEY';

// Configuration
const CONFIG = {
  MAX_PASSAGES: 100,
  MIN_WORDS: 10,
  MAX_CHUNK_LENGTH: 500,
  API_TEMPERATURE: 0.2,
  MAX_OUTPUT_TOKENS: 4096,
  MIN_WORD_COUNT: 100, // Skip pages with less than 100 words
  SKIP_PATTERNS: ['/tag/', '/author/', '/page/', '?', '#'] // URL patterns to skip
};

// LLM Optimization Patterns
const LLM_PATTERNS = {
  directAnswers: ['is defined as', 'refers to', 'means that', 'is a type of', 'can be described as'],
  definitions: [/^[\w\s]+ is\s+/i, /^[\w\s]+ are\s+/i, /^[\w\s]+ means\s+/i],
  comparisons: ['vs', 'versus', 'compared to', 'difference between', 'better than'],
  prosConsIndicators: ['pros and cons', 'advantages', 'disadvantages', 'benefits', 'drawbacks'],
  stepPatterns: [/step\s+\d+/i, /^\d+\./m, /first|second|third|finally/i],
  exampleIndicators: ['for example', 'for instance', 'such as', 'e.g.', 'including'],
  expertSignals: ['according to', 'research shows', 'studies indicate', 'experts say'],
  freshness: ['updated', '2024', '2025', 'latest', 'current', 'recent', 'new'],
  conversational: ['you might wonder', 'you may ask', 'let me explain', 'here\'s how'],
  summaryIndicators: ['in summary', 'to summarize', 'key takeaways', 'tldr', 'conclusion', 'in brief']
};

// Schema type definitions and their indicators
const SCHEMA_PATTERNS = {
  Product: {
    required: ['name', 'image', 'offers'],
    valuable: ['brand', 'aggregateRating', 'review', 'sku', 'gtin'],
    indicators: ['price', 'add to cart', 'buy now', 'in stock', 'product', 'shop']
  },
  FAQPage: {
    required: ['mainEntity'],
    valuable: ['author', 'datePublished'],
    // Removed '?' to avoid universal matches and false positives
    indicators: ['frequently asked', 'faq', 'questions', 'q:', 'a:'],
    // Switch to boundary-aware regex patterns (as strings) for implied question starters
    impliedIndicators: [
      '\\b(?:what|why|how|when|where|who|which)\\b',
      '\\bhow (?:do|does|to|much|many)\\b',
      '\\bwhat (?:is|are)\\b',
      '\\bwhen (?:should|do|does|is|are)\\b',
      '\\bwhy (?:is|are|choose|do|does|should)\\b',
      '\\bcan (?:i|you|we)\\b',
      '\\bdo (?:you|i|we)\\b',
      '\\bbenefits of\\b',
      '\\bdifference between\\b',
      '\\bcost of\\b'
    ]
  },
  Article: {
    required: ['headline', 'image', 'datePublished'],
    valuable: ['author', 'publisher', 'dateModified', 'articleBody'],
    indicators: ['posted', 'published', 'author', 'article', 'blog', 'news']
  },
  HowTo: {
    required: ['name', 'step'],
    valuable: ['totalTime', 'estimatedCost', 'supply', 'tool'],
    indicators: ['step 1', 'step 2', 'how to', 'tutorial', 'guide', 'instructions']
  },
  Recipe: {
    required: ['name', 'image', 'recipeIngredient'],
    valuable: ['nutrition', 'recipeYield', 'prepTime', 'cookTime', 'recipeCuisine'],
    indicators: ['ingredients', 'prep time', 'cook time', 'servings', 'recipe']
  },
  LocalBusiness: {
    required: ['name', 'address'],
    valuable: ['telephone', 'openingHours', 'priceRange', 'geo'],
    indicators: ['hours', 'location', 'visit us', 'call us', 'address'],
    localIndicators: ['near me', 'nearby', 'local', 'in ', 'near ']
  },
  FinancialService: {
    required: ['name'],
    valuable: ['priceRange', 'areaServed', 'hasOfferCatalog'],
    indicators: ['financial', 'accounting', 'tax', 'cfo', 'bookkeeping', 'advisory']
  },
  ProfessionalService: {
    required: ['name'],
    valuable: ['priceRange', 'areaServed', 'hasOfferCatalog'],
    indicators: ['consulting', 'services', 'professional', 'expert', 'specialist']
  },
  Service: {
    required: ['name'],
    valuable: ['provider', 'areaServed', 'hasOfferCatalog'],
    indicators: ['service', 'solution', 'offering', 'provide', 'deliver']
  },
  VideoObject: {
    required: ['name', 'description', 'thumbnailUrl'],
    valuable: ['duration', 'uploadDate', 'contentUrl'],
    indicators: ['video', 'watch', 'youtube', 'vimeo', 'iframe[src*="youtube"]']
  },
  Review: {
    required: ['itemReviewed', 'reviewRating', 'author'],
    valuable: ['datePublished', 'reviewBody'],
    indicators: ['review', 'rating', 'stars', 'feedback', 'testimonial', 'client', 'customer'],
    reviewOpportunities: ['testimonial', 'case study', 'success story', 'client feedback', 'customer story']
  },
  Organization: {
    required: ['name'],
    valuable: ['logo', 'url', 'contactPoint', 'sameAs'],
    indicators: ['company', 'about us', 'contact', 'founded']
  },
  BreadcrumbList: {
    required: ['itemListElement'],
    valuable: [],
    indicators: ['breadcrumb', '>', '/', 'navigation']
  }
};

// Schema conflict detection
const SCHEMA_CONFLICTS = {
  'Article,WebPage': 'Consider using only one - Article is more specific',
  'Organization,FinancialService': 'FinancialService extends Organization - may be redundant',
  'LocalBusiness,Organization': 'LocalBusiness extends Organization - use LocalBusiness',
  'Product,Service': 'Choose either Product OR Service based on what you offer'
};

// Industry schema benchmarks
const INDUSTRY_BENCHMARKS = {
  'financial': { avg: 3, excellent: 6 },
  'ecommerce': { avg: 4, excellent: 8 },
  'local': { avg: 2, excellent: 5 },
  'saas': { avg: 3, excellent: 7 },
  'general': { avg: 2, excellent: 5 }
};

// Extract comprehensive page content including schema analysis
function extractLLMOContent() {
  const content = {
    url: window.location.href,
    title: document.title || '',
    meta_description: document.querySelector('meta[name="description"]')?.content || '',
    passages: [],
    schema: [],
    detectedSchemas: [],
    schemaValidation: [],
    schemaConflicts: [],
    contentIndicators: {},
    llm_signals: {
      answer_engine: {
        direct_answers: 0,
        definition_patterns: 0,
        comparison_tables: 0,
        pros_cons_sections: 0,
        lists_quality_score: 0
      },
      semantic_coverage: {
        entities_found: [],
        topic_depth_score: 0,
        related_concepts: 0,
        unique_terms: new Set()
      },
      information_gain: {
        unique_insights: 0,
        original_data: 0,
        expert_quotes: 0,
        statistics_count: 0,
        case_studies: 0
      },
      content_structure: {
        logical_flow_score: 0,
        section_independence: 0,
        hierarchy_clarity: 0,
        scannable_elements: 0,
        chunk_quality: 0
      },
      content_patterns: {
        examples_count: 0,
        step_by_step_sections: 0,
        summary_sections: 0,
        analogies_used: 0,
        natural_language_score: 0
      },
      engagement_signals: {
        estimated_read_time: 0,
        interactive_elements: 0,
        shareable_insights: 0,
        visual_elements: 0
      },
      authority_markers: {
        external_citations: 0,
        internal_links: 0,
        author_bio_present: false,
        last_updated: null,
        trust_signals: 0,
        credentials_mentioned: 0
      },
      freshness_signals: {
        current_year_mentions: 0,
        temporal_keywords: 0,
        update_indicators: 0,
        trending_references: 0
      },
      query_alignment: {
        question_types_covered: new Set(),
        intent_varieties: 0,
        long_tail_opportunities: 0,
        voice_search_optimization: 0
      }
    },
    stats: {
      word_count: 0,
      h1_count: 0,
      h2_count: 0,
      h3_count: 0,
      p_count: 0,
      list_count: 0,
      table_count: 0,
      img_count: 0,
      link_count: 0,
      faq_count: 0,
      implied_faq_count: 0,
      video_count: 0,
      review_count: 0,
      review_opportunities: 0
    }
  };

  // Extract existing schema markup
  const schemas = document.querySelectorAll('script[type="application/ld+json"]');
  schemas.forEach(schema => {
    try {
      const data = JSON.parse(schema.textContent);
      content.schema.push(data);
      
      // Detect implemented schema types
      if (data['@type']) {
        const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']];
        types.forEach(type => {
          if (!content.detectedSchemas.includes(type)) {
            content.detectedSchemas.push(type);
          }
        });
      }
    } catch (e) {}
  });

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

  // Priority 2: H1 tags
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
      content.passages.push({
        type: 'h2',
        text: headingText,
        position: `h2_${idx}`,
        weight: 1.5
      });
      content.stats.h2_count++;

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

  // H3 headings for hierarchy analysis
  const h3s = document.querySelectorAll('h3');
  content.stats.h3_count = h3s.length;

  // Priority 4: Paragraphs
  const paragraphs = document.querySelectorAll('p');
  let pCount = 0;
  paragraphs.forEach((p, idx) => {
    const text = p.textContent.trim();
    if (text && text.split(' ').length >= CONFIG.MIN_WORDS && pCount < 10) {
      content.passages.push({
        type: idx < 3 ? 'paragraph_primary' : 'paragraph',
        text: text.substring(0, CONFIG.MAX_CHUNK_LENGTH),
        position: `p_${idx}`,
        weight: idx < 3 ? 1.4 : 1.0
      });
      pCount++;
    }
    content.stats.p_count++;
  });

  // Priority 5: Lists
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

  // Detect FAQ patterns - both explicit and implied
  const faqSelectors = [
    '[itemtype*="FAQPage"]',
    '[itemtype*="Question"]',
    '.faq',
    '#faq',
    '[class*="faq"]',
    '[class*="question"]',
    '[class*="answer"]'
  ];
  
  let faqCount = 0;
  let impliedFAQCount = 0;
  
  // Check for explicit FAQ sections
  faqSelectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    if (elements.length > 0) {
      faqCount += elements.length;
      
      // Extract Q&A pairs
      elements.forEach((el, idx) => {
        const text = el.textContent.trim();
        const isLikelyQuestion = /(?:^|\s)(what|why|how|when|where|who|which|can|do|does|is|are|should)\b[\s\S]{2,120}\?/i.test(text);
        if (text && isLikelyQuestion) {
          content.passages.push({
            type: 'faq',
            text: text.substring(0, CONFIG.MAX_CHUNK_LENGTH),
            position: `faq_${idx}`,
            weight: 1.6
          });
        }
      });
    }
  });
  
  // Check for implied FAQ patterns in content
  const allText = document.body.textContent.toLowerCase();
  if (SCHEMA_PATTERNS.FAQPage.impliedIndicators) {
    SCHEMA_PATTERNS.FAQPage.impliedIndicators.forEach(pattern => {
      const regex = new RegExp(pattern, 'gi');
      const matches = allText.match(regex);
      if (matches) {
        impliedFAQCount += matches.length;
      }
    });
  }
  
  content.stats.faq_count = faqCount;
  content.stats.implied_faq_count = impliedFAQCount;

  // Detect videos
  const videos = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
  content.stats.video_count = videos.length;

  // Detect reviews and testimonials
  const reviewIndicators = document.querySelectorAll('[itemtype*="Review"], .review, [class*="review"], [class*="rating"], .testimonial, [class*="testimonial"], .case-study, [class*="case-study"]');
  content.stats.review_count = reviewIndicators.length;
  
  // Check for review opportunities in text
  let reviewOpportunityCount = 0;
  const bodyText = document.body.textContent.toLowerCase();
  if (SCHEMA_PATTERNS.Review.reviewOpportunities) {
    SCHEMA_PATTERNS.Review.reviewOpportunities.forEach(pattern => {
      if (bodyText.includes(pattern)) {
        reviewOpportunityCount++;
      }
    });
  }
  content.stats.review_opportunities = reviewOpportunityCount;

  // Calculate total word count
  content.stats.word_count = document.body.textContent.split(/\s+/).filter(word => word.length > 0).length;

  // Analyze LLM optimization signals
  const allParagraphs = document.querySelectorAll('p');
  
  // Direct answer detection
  allParagraphs.forEach(p => {
    const pText = p.textContent;
    LLM_PATTERNS.directAnswers.forEach(pattern => {
      if (pText.includes(pattern)) {
        content.llm_signals.answer_engine.direct_answers++;
      }
    });
    
    // Definition patterns
    LLM_PATTERNS.definitions.forEach(pattern => {
      if (pattern.test(pText)) {
        content.llm_signals.answer_engine.definition_patterns++;
      }
    });
  });
  
  // Comparison detection
  const comparisons = document.querySelectorAll('table');
  content.stats.table_count = comparisons.length;
  LLM_PATTERNS.comparisons.forEach(pattern => {
    if (bodyText.includes(pattern)) {
      content.llm_signals.answer_engine.comparison_tables++;
    }
  });
  
  // Pros and cons detection
  LLM_PATTERNS.prosConsIndicators.forEach(pattern => {
    if (bodyText.includes(pattern)) {
      content.llm_signals.answer_engine.pros_cons_sections++;
    }
  });
  
  // Example counting
  LLM_PATTERNS.exampleIndicators.forEach(pattern => {
    const matches = bodyText.match(new RegExp(pattern, 'gi'));
    if (matches) {
      content.llm_signals.content_patterns.examples_count += matches.length;
    }
  });
  
  // Step-by-step detection
  LLM_PATTERNS.stepPatterns.forEach(pattern => {
    const matches = bodyText.match(pattern);
    if (matches) {
      content.llm_signals.content_patterns.step_by_step_sections++;
    }
  });
  
  // Expert quotes and citations
  LLM_PATTERNS.expertSignals.forEach(pattern => {
    const matches = bodyText.match(new RegExp(pattern, 'gi'));
    if (matches) {
      content.llm_signals.information_gain.expert_quotes += matches.length;
    }
  });
  
  // Statistics and numbers
  const stats = bodyText.match(/\d+\.?\d*\s*%|\$\s*\d+|\d+\s*(million|billion|thousand)/gi);
  content.llm_signals.information_gain.statistics_count = stats ? stats.length : 0;
  
  // Freshness signals
  LLM_PATTERNS.freshness.forEach(pattern => {
    const matches = bodyText.match(new RegExp(pattern, 'gi'));
    if (matches) {
      content.llm_signals.freshness_signals.temporal_keywords += matches.length;
    }
  });
  
  // Current year mentions
  const currentYear = new Date().getFullYear();
  const yearMatches = bodyText.match(new RegExp(currentYear.toString(), 'g'));
  content.llm_signals.freshness_signals.current_year_mentions = yearMatches ? yearMatches.length : 0;
  
  // Conversational patterns
  LLM_PATTERNS.conversational.forEach(pattern => {
    if (bodyText.includes(pattern)) {
      content.llm_signals.content_patterns.natural_language_score++;
    }
  });
  
  // Summary sections
  LLM_PATTERNS.summaryIndicators.forEach(pattern => {
    if (bodyText.includes(pattern)) {
      content.llm_signals.content_patterns.summary_sections++;
    }
  });
  
  // Links analysis
  const externalLinks = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
  const internalLinks = document.querySelectorAll('a[href^="/"]:not([href^="http"]), a[href*="' + window.location.hostname + '"]');
  content.llm_signals.authority_markers.external_citations = externalLinks.length;
  content.llm_signals.authority_markers.internal_links = internalLinks.length;
  content.stats.link_count = externalLinks.length + internalLinks.length;
  
  // Images and visual elements
  const images = document.querySelectorAll('img');
  content.stats.img_count = images.length;
  content.llm_signals.engagement_signals.visual_elements = images.length;
  
  // Alt text quality check
  let goodAltTexts = 0;
  images.forEach(img => {
    const alt = img.getAttribute('alt');
    if (alt && alt.length > 10 && alt.length < 125) {
      goodAltTexts++;
    }
  });
  
  // Lists quality - FIXED: renamed variable to avoid duplicate declaration
  const listElements = document.querySelectorAll('ul, ol');
  let listItemsTotal = 0;
  listElements.forEach(list => {
    listItemsTotal += list.querySelectorAll('li').length;
  });
  content.llm_signals.answer_engine.lists_quality_score = listElements.length > 0 ? Math.min(100, (listItemsTotal / listElements.length) * 10) : 0;
  
  // Interactive elements
  const interactive = document.querySelectorAll('button, input, select, textarea, iframe, video, audio, .calculator, .tool, .quiz');
  content.llm_signals.engagement_signals.interactive_elements = interactive.length;
  
  // Author bio detection
  const authorIndicators = document.querySelectorAll('[class*="author"], [id*="author"], [rel="author"], .bio, .about-author');
  content.llm_signals.authority_markers.author_bio_present = authorIndicators.length > 0;
  
  // Last updated detection
  const datePatterns = [
    /updated:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /last\s+modified:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i,
    /published:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i
  ];
  
  datePatterns.forEach(pattern => {
    const match = bodyText.match(pattern);
    if (match && !content.llm_signals.authority_markers.last_updated) {
      content.llm_signals.authority_markers.last_updated = match[1];
    }
  });
  
  // Trust signals
  const trustIndicators = ['privacy policy', 'terms of service', 'about us', 'contact us', 'testimonial', 'certified', 'accredited', 'award'];
  trustIndicators.forEach(indicator => {
    if (bodyText.includes(indicator)) {
      content.llm_signals.authority_markers.trust_signals++;
    }
  });
  
  // Question types coverage
  const questionTypes = ['what', 'why', 'how', 'when', 'where', 'who', 'which'];
  questionTypes.forEach(qType => {
    if (bodyText.includes(qType + ' ')) {
      content.llm_signals.query_alignment.question_types_covered.add(qType);
    }
  });
  
  // Calculate reading time (words per minute)
  content.llm_signals.engagement_signals.estimated_read_time = Math.ceil(content.stats.word_count / 200);
  
  // Hierarchy clarity score
  const headingHierarchy = content.stats.h1_count > 0 && content.stats.h2_count > content.stats.h1_count;
  content.llm_signals.content_structure.hierarchy_clarity = headingHierarchy ? 100 : 50;
  
  // Scannable elements
  content.llm_signals.content_structure.scannable_elements = 
    content.stats.h2_count + 
    content.stats.list_count + 
    content.stats.table_count + 
    images.length;
  
  // Case studies detection
  const caseStudyIndicators = ['case study', 'success story', 'client story', 'customer story', 'real-world example'];
  caseStudyIndicators.forEach(indicator => {
    if (bodyText.includes(indicator)) {
      content.llm_signals.information_gain.case_studies++;
    }
  });
  
  // Voice search optimization
  const voicePatterns = ['near me', 'how do i', 'what\'s the best way to', 'can you tell me'];
  voicePatterns.forEach(pattern => {
    if (bodyText.includes(pattern)) {
      content.llm_signals.query_alignment.voice_search_optimization++;
    }
  });
  
  // Unique terms for semantic coverage
  const words = bodyText.split(/\s+/);
  const technicalTerms = words.filter(word => word.length > 7);
  content.llm_signals.semantic_coverage.unique_terms = new Set(technicalTerms);
  content.llm_signals.semantic_coverage.related_concepts = content.llm_signals.semantic_coverage.unique_terms.size;
  
  // Check for schema type indicators including local patterns
  const htmlContent = document.documentElement.innerHTML.toLowerCase();
  for (const [schemaType, config] of Object.entries(SCHEMA_PATTERNS)) {
    let indicatorCount = 0;
    config.indicators.forEach(indicator => {
      if (bodyText.includes(indicator) || htmlContent.includes(indicator)) {
        indicatorCount++;
      }
    });
    
    // Check for additional pattern types
    if (config.impliedIndicators) {
      config.impliedIndicators.forEach(pattern => {
        try {
          const re = new RegExp(pattern, 'gi');
          const matches = bodyText.match(re);
          if (matches) {
            indicatorCount += matches.length; // count all occurrences
          }
        } catch (e) {
          // Fallback to substring match if pattern is not a valid regex
          if (bodyText.includes(pattern)) {
            indicatorCount++;
          }
        }
      });
    }
    
    if (config.localIndicators) {
      config.localIndicators.forEach(indicator => {
        if (bodyText.includes(indicator)) {
          indicatorCount++;
        }
      });
    }
    
    if (indicatorCount > 0) {
      content.contentIndicators[schemaType] = indicatorCount;
    }
  }
  
  // Detect potential schema conflicts
  content.schemaConflicts = [];
  const implementedTypes = content.detectedSchemas.join(',');
  for (const [conflictPair, message] of Object.entries(SCHEMA_CONFLICTS)) {
    const types = conflictPair.split(',');
    if (types.every(type => implementedTypes.includes(type))) {
      content.schemaConflicts.push({ types: conflictPair, message });
    }
  }

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
      if (schema['@type'].includes('Recipe')) return 'recipe';
      if (schema['@type'].includes('FinancialService')) return 'financial';
      if (schema['@type'].includes('ProfessionalService')) return 'professional';
    }
  }
  
  // URL patterns
  if (/\/(product|shop|item|buy)/.test(url)) return 'product';
  if (/\/(blog|article|news|post)/.test(url)) return 'article';
  if (/\/(docs?|documentation|guide|tutorial|how-to)/.test(url)) return 'technical';
  if (/\/(category|categories|collection)/.test(url)) return 'category';
  if (/\/(faq|questions|help)/.test(url)) return 'faq';
  if (/\/(recipe|recipes)/.test(url)) return 'recipe';
  if (/\/(services?|solutions?)/.test(url)) return 'professional';
  
  // Content patterns
  if (/price|add to cart|buy now|\$\d+/.test(bodyText)) return 'product';
  if (/published|author|posted on|reading time/.test(bodyText)) return 'article';
  if (/step \d|tutorial|guide|how to|instructions/.test(bodyText)) return 'technical';
  if (/ingredients|prep time|servings/.test(bodyText)) return 'recipe';
  if (/financial|accounting|tax|cfo/.test(bodyText)) return 'financial';
  
  return 'general';
}

// Helper function to format raw JSON with proper indentation
function formatRawJson(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    // If parsing fails, return original string
    return jsonString;
  }
}

try {
  // Pre-checks to skip low-value pages
  const url = window.location.href;
  const bodyText = document.body.textContent.trim();
  const wordCount = bodyText.split(/\s+/).filter(word => word.length > 0).length;
  
  // Skip if URL contains patterns we want to ignore
  if (CONFIG.SKIP_PATTERNS.some(pattern => url.includes(pattern))) {
    return seoSpider.data('=== SKIPPED: URL contains excluded pattern ===\n\n' + '='.repeat(80) + '\n\n');
  }
  
  // Skip if page has too little content
  if (wordCount < CONFIG.MIN_WORD_COUNT) {
    return seoSpider.data(`=== SKIPPED: Insufficient content (${wordCount} words) ===\n\n` + '='.repeat(80) + '\n\n');
  }
  
  const content = extractLLMOContent();
  const contentType = detectContentType(content);

  // Create enhanced LLMO analysis prompt with comprehensive signals
  const prompt = `You are an expert LLM Optimization (LLMO) and Schema.org analyst. Analyze this webpage comprehensively for how well it would perform in LLM-based search systems, considering both schema opportunities and content quality factors.

URL: ${content.url}
Content Type: ${contentType}
Word Count: ${content.stats.word_count}
Reading Time: ${content.llm_signals.engagement_signals.estimated_read_time} minutes
Currently Implemented Schemas: ${content.detectedSchemas.join(', ') || 'None'}

=== COMPREHENSIVE LLM SIGNALS ===

ANSWER ENGINE OPTIMIZATION:
- Direct Answers Found: ${content.llm_signals.answer_engine.direct_answers}
- Definition Patterns: ${content.llm_signals.answer_engine.definition_patterns}
- Comparison Content: ${content.llm_signals.answer_engine.comparison_tables}
- Pros/Cons Sections: ${content.llm_signals.answer_engine.pros_cons_sections}
- List Quality Score: ${content.llm_signals.answer_engine.lists_quality_score}

CONTENT PATTERNS:
- Examples Provided: ${content.llm_signals.content_patterns.examples_count}
- Step-by-Step Sections: ${content.llm_signals.content_patterns.step_by_step_sections}
- Summary Sections: ${content.llm_signals.content_patterns.summary_sections}
- Natural Language Score: ${content.llm_signals.content_patterns.natural_language_score}

INFORMATION GAIN:
- Expert Quotes: ${content.llm_signals.information_gain.expert_quotes}
- Statistics/Data Points: ${content.llm_signals.information_gain.statistics_count}
- Case Studies: ${content.llm_signals.information_gain.case_studies}

AUTHORITY & TRUST:
- External Citations: ${content.llm_signals.authority_markers.external_citations}
- Internal Links: ${content.llm_signals.authority_markers.internal_links}
- Author Bio Present: ${content.llm_signals.authority_markers.author_bio_present}
- Trust Signals: ${content.llm_signals.authority_markers.trust_signals}
- Last Updated: ${content.llm_signals.authority_markers.last_updated || 'Not found'}

FRESHNESS SIGNALS:
- Current Year Mentions: ${content.llm_signals.freshness_signals.current_year_mentions}
- Temporal Keywords: ${content.llm_signals.freshness_signals.temporal_keywords}

CONTENT STRUCTURE:
- Hierarchy Score: ${content.llm_signals.content_structure.hierarchy_clarity}
- Scannable Elements: ${content.llm_signals.content_structure.scannable_elements}
- Tables: ${content.stats.table_count}
- Images: ${content.stats.img_count}

QUERY ALIGNMENT:
- Question Types Covered: ${Array.from(content.llm_signals.query_alignment.question_types_covered).join(', ')}
- Voice Search Optimization: ${content.llm_signals.query_alignment.voice_search_optimization}

=== SCHEMA ANALYSIS DATA ===

PAGE STATISTICS:
- FAQ indicators found: ${content.stats.faq_count}
- Implied FAQ patterns: ${content.stats.implied_faq_count}
- Videos found: ${content.stats.video_count}
- Review indicators found: ${content.stats.review_count}
- Review opportunities: ${content.stats.review_opportunities}

POTENTIAL SCHEMA CONFLICTS:
${content.schemaConflicts.length > 0 ? JSON.stringify(content.schemaConflicts, null, 2) : 'None detected'}

CONTENT INDICATORS FOR SCHEMAS:
${JSON.stringify(content.contentIndicators, null, 2)}

PAGE CONTENT PASSAGES:
${JSON.stringify(content.passages.slice(0, 50), null, 2)}

CURRENT STRUCTURED DATA:
${content.schema.length > 0 ? JSON.stringify(content.schema, null, 2) : 'None'}

Perform the following comprehensive analysis:

1. ANSWER ENGINE READINESS:
- Evaluate how well the content answers queries directly
- Score the content's ability to be extracted as featured snippets
- Identify gaps in answer comprehensiveness

2. CONTENT QUALITY ASSESSMENT:
- Topic Coverage: How comprehensively does the page cover the topic?
- Information Uniqueness: What unique value does this page provide?
- Content Depth: Is the content surface-level or comprehensive?
- E-E-A-T Signals: Rate Experience, Expertise, Authoritativeness, Trust

3. LLM PARSING OPTIMIZATION:
- Chunk Quality: How well does content break into LLM-digestible chunks?
- Context Independence: Can sections stand alone as answers?
- Semantic Structure: How clear are the relationships between concepts?

4. QUERY INTENT ALIGNMENT:
- Multi-Intent Coverage: Does the page satisfy multiple user intents?
- Intent Clarity: How well does content match likely search intents?
- Query Expansion: What related queries could this content answer?

5. COMPETITIVE DIFFERENTIATION:
- Unique Value Proposition: What makes this content stand out?
- Content Gaps vs Leaders: What are competitors covering that this page isn't?
- Format Innovation: Are there unique content formats used?

6. SCHEMA OPPORTUNITY ANALYSIS:
- All previous schema analysis requirements
- How schemas would enhance the content signals above

7. ENGAGEMENT PREDICTIONS:
- Likely dwell time based on content depth
- Share-worthiness of insights
- Reference value for users

8. OPTIMIZATION PRIORITIES:
- Rank all improvements by impact and effort
- Identify quick wins vs long-term improvements

OUTPUT FORMAT (JSON):
{
  "primary_topic": "main topic/entity",
  "content_type_confirmed": "${contentType}",
  "industry_type": "financial|ecommerce|local|saas|general",
  
  "answer_engine_readiness": {
    "overall_score": 0-100,
    "direct_answer_quality": "poor|fair|good|excellent",
    "featured_snippet_potential": "low|medium|high",
    "answer_gaps": ["List of missing answer types"]
  },
  
  "content_quality_metrics": {
    "topic_coverage_score": 0-100,
    "information_uniqueness": 0-100,
    "content_depth": "surface|moderate|comprehensive|exhaustive",
    "eeat_scores": {
      "experience": 0-100,
      "expertise": 0-100,
      "authoritativeness": 0-100,
      "trustworthiness": 0-100
    }
  },
  
  "llm_optimization_scores": {
    "chunk_quality": 0-100,
    "context_independence": 0-100,
    "semantic_clarity": 0-100,
    "overall_llm_readiness": 0-100
  },
  
  "query_performance_analysis": {
    "multi_intent_coverage": "single|partial|comprehensive",
    "primary_intents_covered": ["informational", "commercial", "navigational"],
    "query_expansion_opportunities": 15,
    "voice_search_readiness": "poor|fair|good|excellent"
  },
  
  "competitive_analysis": {
    "unique_value_score": 0-100,
    "content_differentiation": ["List unique elements"],
    "missing_vs_competitors": ["Common elements in top results but missing here"],
    "format_innovation_score": 0-100
  },
  
  "schema_analysis": {
    // All previous schema analysis fields
    "implemented_schemas": [],
    "missing_schemas": [],
    "schema_conflicts": [],
    "total_opportunities": 0,
    "implemented_count": 0,
    "schema_coverage_score": 0,
    "industry_benchmark": {}
  },
  
  "engagement_predictions": {
    "estimated_dwell_time": "seconds",
    "shareability_score": 0-100,
    "reference_value": 0-100,
    "return_visit_likelihood": "low|medium|high"
  },
  
  "target_queries": [
    {
      "query": "example query",
      "current_score": 3.5,
      "potential_score_with_optimization": 4.8,
      "limiting_factors": ["Direct answers", "Schema", "Depth"],
      "best_passages": ["title", "h2_0"],
      "answer_quality": "partial|complete|comprehensive"
    }
  ],
  
  "optimization_roadmap": {
    "critical_fixes": [
      {
        "issue": "No direct answers in intro",
        "fix": "Add definition in first paragraph",
        "impact": "HIGH",
        "effort": "15 minutes"
      }
    ],
    "quick_wins": [],
    "content_additions": [],
    "structural_improvements": [],
    "schema_implementations": []
  },
  
  "overall_llmo_score": 0-100,
  "potential_llmo_score": 0-100,
  "primary_limiting_factors": ["Top 3 issues holding back performance"],
  
  "generated_faqs": [],
  "roi_analysis": {},
  "key_recommendations": []
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
  xhr.open('POST', `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, false);
  xhr.setRequestHeader('Content-Type', 'application/json');

  xhr.send(JSON.stringify(requestData));

  if (xhr.status === 200) {
    let response;
    try {
      response = JSON.parse(xhr.responseText);
    } catch (parseError) {
      return seoSpider.error('Failed to parse API response: ' + parseError.toString() + '\n\nRaw response: ' + xhr.responseText.substring(0, 500));
    }

    // Check for API response structure with detailed error handling
    if (!response) {
      return seoSpider.error('Response is null or undefined');
    }
    
    if (!response.candidates) {
      return seoSpider.error('No candidates in response. Full response: ' + JSON.stringify(response).substring(0, 1000));
    }
    
    if (!Array.isArray(response.candidates) || response.candidates.length === 0) {
      return seoSpider.error('Candidates is not an array or is empty. Response: ' + JSON.stringify(response).substring(0, 1000));
    }
    
    const candidate = response.candidates[0];
    if (!candidate) {
      return seoSpider.error('First candidate is undefined');
    }
    
    if (!candidate.content) {
      return seoSpider.error('Candidate has no content. Candidate: ' + JSON.stringify(candidate).substring(0, 500));
    }
    
    if (!candidate.content.parts) {
      return seoSpider.error('Content has no parts. Content: ' + JSON.stringify(candidate.content).substring(0, 500));
    }
    
    if (!Array.isArray(candidate.content.parts) || candidate.content.parts.length === 0) {
      return seoSpider.error('Parts is not an array or is empty. Content: ' + JSON.stringify(candidate.content).substring(0, 500));
    }
    
    const firstPart = candidate.content.parts[0];
    if (!firstPart) {
      return seoSpider.error('First part is undefined');
    }
    
    const analysisText = firstPart.text;
    if (!analysisText) {
      return seoSpider.error('Text is empty or undefined. Part: ' + JSON.stringify(firstPart).substring(0, 500));
    }
      
      try {
        const analysis = JSON.parse(analysisText);
        
        // Format enhanced output for Screaming Frog
        let output = '=== LLMO ANALYSIS RESULTS ===\n\n';
        
        // Overall metrics
        output += `OVERALL LLMO SCORE: ${analysis.overall_llmo_score}/100\n`;
        output += `POTENTIAL SCORE: ${analysis.potential_llmo_score}/100\n`;
        output += `OPTIMIZATION PRIORITY: ${analysis.optimization_priority || 'MEDIUM'}\n`;
        output += `PRIMARY LIMITING FACTORS: ${analysis.primary_limiting_factors ? analysis.primary_limiting_factors.join(', ') : 'None identified'}\n\n`;
        
        // Answer Engine Readiness
        if (analysis.answer_engine_readiness) {
          output += '=== ANSWER ENGINE READINESS ===\n';
          output += `Overall Score: ${analysis.answer_engine_readiness.overall_score}/100\n`;
          output += `Direct Answer Quality: ${analysis.answer_engine_readiness.direct_answer_quality}\n`;
          output += `Featured Snippet Potential: ${analysis.answer_engine_readiness.featured_snippet_potential}\n`;
          if (analysis.answer_engine_readiness.answer_gaps && analysis.answer_engine_readiness.answer_gaps.length > 0) {
            output += `Answer Gaps: ${analysis.answer_engine_readiness.answer_gaps.join(', ')}\n`;
          }
          output += '\n';
        }
        
        // Content Quality Metrics
        if (analysis.content_quality_metrics) {
          output += '=== CONTENT QUALITY METRICS ===\n';
          output += `Topic Coverage: ${analysis.content_quality_metrics.topic_coverage_score}/100\n`;
          output += `Information Uniqueness: ${analysis.content_quality_metrics.information_uniqueness}/100\n`;
          output += `Content Depth: ${analysis.content_quality_metrics.content_depth}\n`;
          if (analysis.content_quality_metrics.eeat_scores) {
            output += '\nE-E-A-T Scores:\n';
            output += `• Experience: ${analysis.content_quality_metrics.eeat_scores.experience}/100\n`;
            output += `• Expertise: ${analysis.content_quality_metrics.eeat_scores.expertise}/100\n`;
            output += `• Authority: ${analysis.content_quality_metrics.eeat_scores.authoritativeness}/100\n`;
            output += `• Trust: ${analysis.content_quality_metrics.eeat_scores.trustworthiness}/100\n`;
          }
          output += '\n';
        }
        
        // LLM Optimization Scores
        if (analysis.llm_optimization_scores) {
          output += '=== LLM PARSING OPTIMIZATION ===\n';
          output += `Chunk Quality: ${analysis.llm_optimization_scores.chunk_quality}/100\n`;
          output += `Context Independence: ${analysis.llm_optimization_scores.context_independence}/100\n`;
          output += `Semantic Clarity: ${analysis.llm_optimization_scores.semantic_clarity}/100\n`;
          output += `Overall LLM Readiness: ${analysis.llm_optimization_scores.overall_llm_readiness}/100\n\n`;
        }
        
        // Query Performance
        if (analysis.query_performance_analysis) {
          output += '=== QUERY PERFORMANCE ===\n';
          output += `Multi-Intent Coverage: ${analysis.query_performance_analysis.multi_intent_coverage}\n`;
          output += `Voice Search Readiness: ${analysis.query_performance_analysis.voice_search_readiness}\n`;
          output += `Query Expansion Opportunities: ${analysis.query_performance_analysis.query_expansion_opportunities}\n\n`;
        }
        
        // Competitive Analysis
        if (analysis.competitive_analysis) {
          output += '=== COMPETITIVE ANALYSIS ===\n';
          output += `Unique Value Score: ${analysis.competitive_analysis.unique_value_score}/100\n`;
          output += `Format Innovation: ${analysis.competitive_analysis.format_innovation_score}/100\n`;
          if (analysis.competitive_analysis.missing_vs_competitors && analysis.competitive_analysis.missing_vs_competitors.length > 0) {
            output += 'Missing vs Competitors:\n';
            analysis.competitive_analysis.missing_vs_competitors.forEach(item => {
              output += `• ${item}\n`;
            });
          }
          output += '\n';
        }
        
        // Schema Coverage Score
        if (analysis.schema_analysis) {
          output += `SCHEMA COVERAGE SCORE: ${analysis.schema_analysis.schema_coverage_score}%\n\n`;
        }
        
        // ROI Analysis
        if (analysis.roi_analysis && analysis.roi_analysis.estimated_traffic_increase_percent) {
          output += '=== ROI ANALYSIS ===\n';
          output += `Estimated Traffic Increase: +${analysis.roi_analysis.estimated_traffic_increase_percent}%\n`;
          output += `Implementation Hours: ${analysis.roi_analysis.total_implementation_hours}\n`;
          output += `ROI Rating: ${analysis.roi_analysis.roi_rating}\n`;
          output += `Expected Payback: ${analysis.roi_analysis.payback_period}\n\n`;
        }
        
        // Industry Benchmark
        if (analysis.schema_analysis && analysis.schema_analysis.industry_benchmark && analysis.schema_analysis.industry_benchmark.average) {
          const benchmark = analysis.schema_analysis.industry_benchmark;
          output += '=== INDUSTRY SCHEMA BENCHMARK ===\n';
          output += `Industry Average: ${benchmark.average} schemas\n`;
          output += `Excellence Level: ${benchmark.excellent} schemas\n`;
          output += `Your Count: ${benchmark.your_count} schemas\n`;
          output += `Competitive Position: ${benchmark.competitive_position}\n\n`;
        }
        
        // Engagement Predictions
        if (analysis.engagement_predictions) {
          output += '=== ENGAGEMENT PREDICTIONS ===\n';
          output += `Estimated Dwell Time: ${analysis.engagement_predictions.estimated_dwell_time}\n`;
          output += `Shareability Score: ${analysis.engagement_predictions.shareability_score}/100\n`;
          output += `Reference Value: ${analysis.engagement_predictions.reference_value}/100\n`;
          output += `Return Visit Likelihood: ${analysis.engagement_predictions.return_visit_likelihood}\n\n`;
        }
        
        // Critical Fixes
        if (analysis.optimization_roadmap && analysis.optimization_roadmap.critical_fixes && analysis.optimization_roadmap.critical_fixes.length > 0) {
          output += '=== 🚨 CRITICAL FIXES ===\n';
          analysis.optimization_roadmap.critical_fixes.forEach(fix => {
            output += `• ${fix.issue}\n`;
            output += `  Fix: ${fix.fix} (${fix.effort}, Impact: ${fix.impact})\n`;
          });
          output += '\n';
        }
        
        // Quick Wins
        if (analysis.quick_wins && analysis.quick_wins.length > 0) {
          output += '=== 🎯 QUICK WINS ===\n';
          analysis.quick_wins.forEach(win => {
            output += `• ${win.action} (${win.hours}h, ${win.impact}, ${win.difficulty})\n`;
          });
          output += '\n';
        }
        
        // Schema implementation status
        output += '=== SCHEMA IMPLEMENTATION STATUS ===\n';
        if (analysis.schema_analysis) {
          output += `✅ IMPLEMENTED: ${analysis.schema_analysis.implemented_count} schemas\n`;
          
          if (analysis.schema_analysis.implemented_schemas && analysis.schema_analysis.implemented_schemas.length > 0) {
            if (typeof analysis.schema_analysis.implemented_schemas[0] === 'string') {
              // Handle simple string array
              analysis.schema_analysis.implemented_schemas.forEach(s => {
                output += `  - ${s}\n`;
              });
            } else {
              // Handle object array
              analysis.schema_analysis.implemented_schemas.forEach(s => {
                output += `  - ${s.type} (${s.completeness_score}% complete)\n`;
                if (s.validation_issues && s.validation_issues.length > 0) {
                  output += `    ⚠️ Issues: ${s.validation_issues.join(', ')}\n`;
                }
              });
            }
          }
          
          // Schema conflicts
          if (analysis.schema_analysis.schema_conflicts && analysis.schema_analysis.schema_conflicts.length > 0) {
            output += '\n⚠️ SCHEMA CONFLICTS:\n';
            analysis.schema_analysis.schema_conflicts.forEach(conflict => {
              output += `  - ${conflict}\n`;
            });
          }
          
          output += `\n❌ MISSING OPPORTUNITIES: ${analysis.schema_analysis.total_opportunities - analysis.schema_analysis.implemented_count} schemas\n`;
          
          // High priority missing schemas
          if (analysis.schema_analysis.missing_schemas && analysis.schema_analysis.missing_schemas.length > 0) {
            const criticalSchemas = analysis.schema_analysis.missing_schemas.filter(s => 
              typeof s === 'object' && (s.priority === 'CRITICAL' || s.priority === 'HIGH')
            );
            if (criticalSchemas.length > 0) {
              output += '\nHIGH-VALUE MISSING SCHEMAS:\n';
              criticalSchemas.forEach(s => {
                output += `  - ${s.type} (${s.priority})\n`;
                if (s.supporting_content) output += `    → ${s.supporting_content}\n`;
                if (s.expected_impact) output += `    → Impact: ${s.expected_impact}\n`;
              });
            } else if (analysis.schema_analysis.missing_schemas.length > 0) {
              // Handle simple string array
              output += '\nMISSING SCHEMAS:\n';
              const schemasToShow = analysis.schema_analysis.missing_schemas.slice(0, 5);
              schemasToShow.forEach(s => {
                output += `  - ${typeof s === 'string' ? s : s.type || s}\n`;
              });
            }
          }
        }
        
        // Content-Schema alignment (if exists)
        if (analysis.content_schema_alignment) {
          output += '\n=== CONTENT-SCHEMA ALIGNMENT ===\n';
          output += `Content Richness: ${analysis.content_schema_alignment.content_richness}%\n`;
          output += `Schema Coverage: ${analysis.content_schema_alignment.schema_coverage}%\n`;
          output += `Untapped Potential: ${analysis.content_schema_alignment.alignment_gap}%\n`;
        }
        
        // Target queries with comprehensive scoring
        if (analysis.target_queries && analysis.target_queries.length > 0) {
          output += '\n=== TARGET QUERIES & COMPREHENSIVE IMPACT ===\n';
          analysis.target_queries.slice(0, 5).forEach((q, idx) => {
            output += `${idx + 1}. "${q.query}"\n`;
            output += `   Current Score: ${q.current_score}/5 → Potential: ${q.potential_score_with_optimization || q.potential_score_with_schemas}/5\n`;
            if (q.answer_quality) {
              output += `   Answer Quality: ${q.answer_quality}\n`;
            }
            if (q.limiting_factors && q.limiting_factors.length > 0) {
              output += `   Limited by: ${q.limiting_factors.join(', ')}\n`;
            }
          });
        }
        
        // Generated FAQs
        if (analysis.generated_faqs && analysis.generated_faqs.length > 0) {
          output += '\n=== SUGGESTED FAQS FROM CONTENT ===\n';
          analysis.generated_faqs.slice(0, 5).forEach((faq, idx) => {
            output += `${idx + 1}. Q: ${faq.question}\n`;
            output += `   A: ${faq.answer.substring(0, 150)}...\n`;
          });
        }
        
        // Review Strategy (if exists)
        if (analysis.review_strategy) {
          output += '\n=== REVIEW SCHEMA STRATEGY ===\n';
          if (analysis.review_strategy.testimonial_conversion) {
            output += `• ${analysis.review_strategy.testimonial_conversion}\n`;
          }
          if (analysis.review_strategy.case_study_structure) {
            output += `• ${analysis.review_strategy.case_study_structure}\n`;
          }
          if (analysis.review_strategy.aggregate_rating) {
            output += `• ${analysis.review_strategy.aggregate_rating}\n`;
          }
        }
        
        // Content Additions
        if (analysis.optimization_roadmap && analysis.optimization_roadmap.content_additions && analysis.optimization_roadmap.content_additions.length > 0) {
          output += '\n=== CONTENT ADDITIONS NEEDED ===\n';
          analysis.optimization_roadmap.content_additions.forEach(addition => {
            if (typeof addition === 'string') {
              output += `• ${addition}\n`;
            } else if (addition.issue) {
              output += `• ${addition.issue}: ${addition.fix}\n`;
            }
          });
        }
        
        // Schema implementation roadmap (if exists)
        if (analysis.schema_implementation_roadmap) {
          output += '\n=== SCHEMA IMPLEMENTATION ROADMAP ===\n';
          if (analysis.schema_implementation_roadmap.immediate && analysis.schema_implementation_roadmap.immediate.length > 0) {
            output += 'IMMEDIATE (Do Today):\n';
            analysis.schema_implementation_roadmap.immediate.forEach(action => {
              output += `• ${action}\n`;
            });
          }
          
          if (analysis.schema_implementation_roadmap.high_priority && analysis.schema_implementation_roadmap.high_priority.length > 0) {
            output += '\nHIGH PRIORITY (This Week):\n';
            analysis.schema_implementation_roadmap.high_priority.forEach(action => {
              output += `• ${action}\n`;
            });
          }
        }
        
        // Key recommendations with effort/impact
        if (analysis.key_recommendations && analysis.key_recommendations.length > 0) {
          output += '\n=== TOP RECOMMENDATIONS ===\n';
          analysis.key_recommendations.slice(0, 5).forEach((rec, idx) => {
            if (typeof rec === 'string') {
              output += `${idx + 1}. ${rec}\n`;
            } else if (rec.action) {
              output += `${idx + 1}. ${rec.action}\n`;
              if (rec.effort) output += `   Effort: ${rec.effort}`;
              if (rec.impact) output += ` | Impact: ${rec.impact}\n`;
              if (rec.details) output += `   Details: ${rec.details}\n`;
            }
          });
        }
        
        // Comprehensive Page Statistics
        output += '\n=== COMPREHENSIVE PAGE STATISTICS ===\n';
        output += `• Word Count: ${content.stats.word_count}\n`;
        output += `• Reading Time: ${content.llm_signals.engagement_signals.estimated_read_time} minutes\n`;
        output += `• Content Structure:\n`;
        output += `  - H1 Tags: ${content.stats.h1_count}\n`;
        output += `  - H2 Tags: ${content.stats.h2_count}\n`;
        output += `  - H3 Tags: ${content.stats.h3_count}\n`;
        output += `  - Paragraphs: ${content.stats.p_count}\n`;
        output += `  - Lists: ${content.stats.list_count}\n`;
        output += `  - Tables: ${content.stats.table_count}\n`;
        output += `  - Images: ${content.stats.img_count}\n`;
        output += `• LLM Signals:\n`;
        output += `  - Direct Answers: ${content.llm_signals.answer_engine.direct_answers}\n`;
        output += `  - Examples Provided: ${content.llm_signals.content_patterns.examples_count}\n`;
        output += `  - Statistics/Data: ${content.llm_signals.information_gain.statistics_count}\n`;
        output += `  - Expert Quotes: ${content.llm_signals.information_gain.expert_quotes}\n`;
        output += `  - External Links: ${content.llm_signals.authority_markers.external_citations}\n`;
        output += `  - Internal Links: ${content.llm_signals.authority_markers.internal_links}\n`;
        output += `• Schema Status:\n`;
        output += `  - Current Schemas: ${content.detectedSchemas.length > 0 ? content.detectedSchemas.join(', ') : 'None'}\n`;
        output += `  - FAQ Indicators: ${content.stats.faq_count}\n`;
        output += `  - Implied FAQ Patterns: ${content.stats.implied_faq_count}\n`;
        output += `  - Review Opportunities: ${content.stats.review_opportunities}\n`;
        output += `• Content Type: ${contentType}\n`;
        
        // Store raw JSON for custom extractions
        output += `\n\n=== RAW JSON DATA ===\n${JSON.stringify(analysis, null, 2)}`;
        
        // Add separator for better readability in bulk exports
        output += '\n\n' + '='.repeat(80) + '\n\n';
        
        return seoSpider.data(output);
        
      } catch (parseError) {
        // If JSON parsing fails, return the raw response with better formatting
        return seoSpider.data('=== LLMO ANALYSIS (RAW) ===\n\nParse Error: ' + parseError.toString() + '\n\n' + analysisText.substring(0, 1000) + '\n\n' + '='.repeat(80) + '\n\n');
      }
  } else {
    const errorBody = xhr.responseText;
    return seoSpider.error(`API Error ${xhr.status}: ${errorBody}`);
  }
} catch (error) {
  return seoSpider.error(`Script Error: ${error.toString()}`);
}
