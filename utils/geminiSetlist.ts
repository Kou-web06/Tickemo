const SETLIST_EXTRACTION_PROMPT_BASE = `あなたはプロの音楽ライターです。提供された画像はライブのセットリストです。
画像から『演奏された曲名』のみを順番に抽出し、JSONの配列形式で出力してください。

【厳格なルール】
1. 曲名以外のノイズ（MC、Encore、SE、連番の数字、アーティスト名など）は完全に除外すること。
2. 画像の文字が崩れていて誤字脱字（おかしな名前）になっている場合、音楽の文脈から推測して『実在する正しい曲名表記』に補正してから出力すること。
3. 出力は必ず ["曲名1", "曲名2"] という純粋なJSON文字列の配列のみとし、\`\`\`json などのマークダウン記法は絶対に含めないこと。`;

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_TIMEOUT_MS = 12000;
const GEMINI_MAX_OUTPUT_TOKENS = 2048;

const buildSetlistExtractionPrompt = (artistName?: string): string => {
  const trimmedArtistName = artistName?.trim();
  if (!trimmedArtistName) {
    return SETLIST_EXTRACTION_PROMPT_BASE;
  }

  return `これは ${trimmedArtistName} のセットリストです。そして、\n${SETLIST_EXTRACTION_PROMPT_BASE}`;
};

const requestGemini = async (
  apiKey: string,
  prompt: string,
  base64Image: string
): Promise<string | null> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: 'image/jpeg',
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[GeminiSetlist] Gemini API request failed:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const responseText = (data?.candidates?.[0]?.content?.parts ?? [])
      .map((part: any) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
      .trim();

    if (!responseText) {
      console.error('[GeminiSetlist] Gemini returned empty text.');
      return null;
    }

    return responseText;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[GeminiSetlist] Gemini request failed:', error);
    return null;
  }
};

export async function extractSetlistFromImage(base64Image: string, artistName?: string): Promise<string[]> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[GeminiSetlist] EXPO_PUBLIC_GEMINI_API_KEY is not set.');
    return [];
  }

  const prompt = buildSetlistExtractionPrompt(artistName);
  const responseText = await requestGemini(apiKey, prompt, base64Image);
  if (!responseText) {
    return [];
  }

  try {
    const parsed = JSON.parse(responseText);
    if (!Array.isArray(parsed)) {
      console.error('[GeminiSetlist] Gemini response is not an array:', parsed);
      return [];
    }

    return parsed
      .filter((value) => typeof value === 'string')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  } catch (error) {
    console.error('[GeminiSetlist] Failed to parse JSON response:', error, responseText);
    return [];
  }
}
