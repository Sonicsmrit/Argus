require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_MODEL = 'gemini-flash-latest';
const FALLBACK_MODELS = ['gemini-flash-lite-latest', 'gemma-4-31b-it'];

// In-memory cache for AI responses
const cache = new Map();

/**
 * Call Gemini API with JSON instruction and model fallback
 */
async function callGemini(prompt, systemInstruction = '') {
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;
      
      const body = {
        contents: [
          {
            parts: [{ text: (systemInstruction ? systemInstruction + "\n\n" : "") + prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          topK: 40,
          topP: 0.95
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        lastError = new Error(`Gemini ${model} error (${response.status}): ${errorText}`);
        continue; // Try fallback
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!text) {
        lastError = new Error(`Empty response from ${model}`);
        continue;
      }

      // Clean markdown code blocks if wrapped in ```json ... ```
      let cleanText = text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      try {
        return JSON.parse(cleanText);
      } catch (e) {
        return { summary: cleanText };
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini models failed');
}

/**
 * Generate Bilateral Trade Risk & Threat Assessment
 */
async function analyzeBilateralRisk({ fromCountry, toCountry, fromName, toName, bilateralRisk, stats, topEntities }) {
  const cacheKey = `bilateral_${fromCountry}_${toCountry}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const prompt = `
You are a senior trade compliance officer and sanctions intelligence analyst.
Analyze the bilateral trade route and regulatory exposure from Origin Country "${fromName}" (${fromCountry}) to Destination Country "${toName}" (${toCountry}).

CONTEXT & METRICS:
- Origin Jurisdiction: ${fromName} (${fromCountry})
- Destination Partner: ${toName} (${toCountry})
- Assessed Risk Level: ${bilateralRisk?.overallLevel || 'STANDARD'} (Score: ${bilateralRisk?.overallRisk || 3}/10)
- Applicable Regimes: ${bilateralRisk?.regimes ? bilateralRisk.regimes.map(r => `${r.regime}: ${r.level} (${r.summary})`).join('; ') : 'Standard'}
- Layer 1 Sanctioned Entities Tagged: ${stats?.entityCount || 0}
- Layer 2 Adverse Media Corroborated Hits: ${stats?.mediaHitEntities || 0}
- Sample High-Exposure Entities: ${topEntities ? topEntities.map(e => `${e.name} (${e.sanctions || 'Sanctioned'}) - ${e.matchCount || 0} media hits`).slice(0, 8).join(', ') : 'None'}

Provide a thorough, professional, and actionable compliance threat assessment in JSON format matching this schema:
{
  "executiveSummary": "2-3 concise paragraphs summarizing the compliance posture, primary legal risks, and immediate trade feasibility.",
  "threatRating": "CRITICAL" | "HIGH" | "ELEVATED" | "MODERATE" | "LOW",
  "threatScore": number (1-100),
  "primaryThreatVectors": [
    {
      "vector": "Title of threat (e.g. Transshipment via Third-Party Hubs, Dual-Use Tech Diversion, Secondary OFAC Sanctions, Front Company Networks)",
      "severity": "CRITICAL" | "HIGH" | "MEDIUM",
      "description": "Detailed explanation of how this risk manifests in shipments or contracts.",
      "redFlags": ["Bullet point 1", "Bullet point 2"]
    }
  ],
  "sectoralRestrictions": [
    {
      "sector": "Sector name (e.g. Aerospace, Advanced Computing, Financial Services, Petrochemicals)",
      "controlStatus": "BANNED" | "LICENSED" | "RESTRICTED",
      "guidance": "Specific compliance requirement for shipments in this sector."
    }
  ],
  "complianceActionPlan": [
    {
      "step": "Action title (e.g. Mandatory End-User Verification, Ownership Diligence (50% Rule), SWIFT Payment Route Audit)",
      "priority": "HIGH" | "MEDIUM",
      "recommendation": "Concrete instruction for procurement and logistics teams."
    }
  ],
  "adverseMediaSignal": "Assessment of the Layer 2 investigative press indicators and what they reveal about emerging enforcement priorities before formal designation."
}
`;

  const systemPrompt = "You are an expert in international sanctions, OFAC, EU FSF, UK OFSI, BIS EAR export controls, and supply chain denied-party screening. Return ONLY valid JSON.";
  const result = await callGemini(prompt, systemPrompt);
  
  cache.set(cacheKey, result);
  return result;
}

/**
 * Generate Deep Entity Threat Analysis
 */
async function analyzeEntity({ entity, articles }) {
  const cacheKey = `entity_${entity.id}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const articlesSummary = (articles || []).map((a, i) => `
Article ${i+1}:
- Headline: ${a.headline}
- Source: ${a.source} (${a.date || 'Recent'})
- Matched in: ${a.matchLocation} (Score: ${a.score})
- Context Snippet: "${a.context || 'N/A'}"
`).join('\n');

  const prompt = `
You are a senior sanctions intelligence investigator.
Conduct a deep-dive denied-party analysis on this target entity by synthesizing official sanctions designations (Layer 1) with investigative media reporting (Layer 2).

ENTITY DETAILS:
- Name: ${entity.name}
- Type: ${entity.schema || 'Entity'}
- Countries: ${entity.countries || 'N/A'}
- Known Aliases: ${entity.aliases || 'None'}
- Official Sanctions Programs: ${entity.sanctions || 'Official List'}
- Source Datasets: ${entity.dataset || 'N/A'}

INVESTIGATIVE MEDIA COVERAGE (Layer 2):
${articlesSummary || 'No direct media hits linked in current corpus.'}

Provide a comprehensive threat assessment in JSON format matching this schema:
{
  "entityOverview": "1-2 paragraphs summarizing the entity's profile, role in geopolitical or illicit activities, and why they are of interest.",
  "threatCategory": "e.g. State Military Procurement, Illicit Narcotics Cartel, Sanctions Evasion Front, Terrorist Financing, Proliferation Network, Kleptocracy / Corruption",
  "significanceRating": "CRITICAL" | "HIGH" | "ELEVATED" | "MODERATE",
  "counterpartyRiskScore": number (1-100),
  "corroborationStatus": "CORROBORATED_BOTH_LAYERS" | "OFFICIAL_LIST_ONLY" | "HIGH_ADVERSE_SIGNAL",
  "adverseMediaSynthesis": "Detailed synthesis of what investigative journalists discovered (contracts, front companies, shell logistics, covert bank accounts) and how it complements or precedes official sanctions.",
  "corporateNetworkRisks": [
    "Risk related to subsidiaries, beneficial ownership, shell companies, or 50% rule exposure"
  ],
  "screeningRecommendation": "Explicit guidance for a logistics or trade compliance officer on handling any transaction mentioning this entity or associated aliases."
}
`;

  const systemPrompt = "You are an expert intelligence analyst specializing in counterparty risk, beneficial ownership, adverse media screening, and international sanctions enforcement. Return ONLY valid JSON.";
  const result = await callGemini(prompt, systemPrompt);

  cache.set(cacheKey, result);
  return result;
}

module.exports = {
  analyzeBilateralRisk,
  analyzeEntity
};
