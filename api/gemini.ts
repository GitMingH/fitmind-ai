// api/gemini.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// 初始化稳定版 SDK
// 注意：确保在 Vercel 后台配置的环境变量名是 GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 仅允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, payload } = req.body;

  try {
    switch (action) {
      // 1. 获取快速健身建议
      case 'getQuickTip': {
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: `你是一位资深的健身与营养专家。当前正在与名为“${payload.userName}”的用户对话。请在回复中自然地称呼用户的名字。无论用户使用何种语言，你必须始终以中文回复。回复应专业、简练且充满正能量。`,
        });
        const result = await model.generateContent(payload.prompt);
        return res.status(200).json({ text: result.response.text() });
      }

      // 2. 分析体态照片
      case 'analyzePhysique': {
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                visualBodyFat: { type: SchemaType.STRING },
                muscleScore: { type: SchemaType.NUMBER },
                advice: { type: SchemaType.STRING },
                fitnessAgeAdjustment: { type: SchemaType.NUMBER }
              },
              required: ['visualBodyFat', 'muscleScore', 'advice', 'fitnessAgeAdjustment']
            }
          }
        });
        const result = await model.generateContent([
          { inlineData: { data: payload.base64Image, mimeType: 'image/jpeg' } },
          { text: "作为AI健身教练，分析这张体态照片。请评估：1. 视觉体脂率区间。2. 肌肉饱满度（1-10分）。3. 给出30字以内的针对性训练建议（中文）。以JSON返回。" }
        ]);
        return res.status(200).json(JSON.parse(result.response.text()));
      }

      // 3. 获取健康洞察 (JSON)
      case 'getHealthInsights': {
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                fitnessAge: { type: SchemaType.NUMBER },
                nextGoal: { type: SchemaType.STRING },
                weeksToTarget: { type: SchemaType.NUMBER }
              },
              required: ['fitnessAge', 'nextGoal', 'weeksToTarget']
            }
          }
        });
        const diff = payload.profile.weight - payload.profile.targetWeight;
        const prompt = `用户信息：${JSON.stringify(payload.profile)}。当前体重${payload.profile.weight}kg，目标${payload.profile.targetWeight}kg，差距${Math.abs(diff)}kg。请提供预测体龄、下周动作和预计达成周数。`;
        const result = await model.generateContent(prompt);
        return res.status(200).json(JSON.parse(result.response.text()));
      }

      // 4. 生成 7 天周计划 (JSON Array)
      case 'generateWeeklyPlan': {
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-pro', // 复杂任务建议用 pro
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  day: { type: SchemaType.STRING },
                  workout: { type: SchemaType.OBJECT, properties: { title: { type: SchemaType.STRING }, details: { type: SchemaType.STRING } }, required: ['title', 'details'] },
                  meals: { type: SchemaType.OBJECT, properties: { breakfast: { type: SchemaType.STRING }, lunch: { type: SchemaType.STRING }, dinner: { type: SchemaType.STRING } }, required: ['breakfast', 'lunch', 'dinner'] }
                },
                required: ['day', 'workout', 'meals']
              }
            }
          }
        });
        const prompt = `基于用户信息：${JSON.stringify(payload.userProfile)} 和最近记录：${JSON.stringify(payload.recentWorkouts)}，生成7天健身与饮食计划。第一天请称呼“${payload.userProfile.name}”。`;
        const result = await model.generateContent(prompt);
        return res.status(200).json(JSON.parse(result.response.text()));
      }

      // 5. 饮食照片识别
      case 'analyzeMealImage': {
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: SchemaType.OBJECT,
              properties: {
                name: { type: SchemaType.STRING },
                calories: { type: SchemaType.NUMBER },
                protein: { type: SchemaType.NUMBER },
                carbs: { type: SchemaType.NUMBER },
                fat: { type: SchemaType.NUMBER },
                healthScore: { type: SchemaType.NUMBER },
                coachTip: { type: SchemaType.STRING }
              },
              required: ['name', 'calories', 'protein', 'carbs', 'fat', 'healthScore', 'coachTip']
            }
          }
        });
        const result = await model.generateContent([
          { inlineData: { data: payload.base64Image, mimeType: 'image/jpeg' } },
          { text: `识别食物照片，给出营养数据，并以教练身份给“${payload.userName}”写一段50字内专业点评（中文）。` }
        ]);
        return res.status(200).json(JSON.parse(result.response.text()));
      }

      // 6. 语音合成 (TTS)
      case 'generateTTS': {
        const model = (genAI as any).getGenerativeModel({ model: "gemini-1.5-flash" }); // 稳定版 TTS 可能需要特定模型名
        const result = await model.generateContent({
          contents: [{ parts: [{ text: payload.text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: payload.voiceName } } }
          }
        });
        const audioData = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return res.status(200).json({ audioData });
      }

      // 7. 图像生成
      case 'generateImage': {
        const model = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-001' as any }); // 确保模型名正确
        const result = await model.generateContent(payload.prompt);
        const imageData = result.response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
        return res.status(200).json({ imageData: imageData ? `data:image/png;base64,${imageData}` : null });
      }

      default:
        return res.status(400).json({ error: 'Unsupported action' });
    }
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message || "内部服务器错误" });
  }
}