// api/gemini.ts
import { GoogleGenAI, Type, Modality } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { action, payload } = req.body;

  try {
    switch (action) {
      case 'getQuickTip': {
        const model = genAI.getGenerativeModel({
          model: 'gemini-3-flash-preview',
          systemInstruction: `你是一位资深的健身与营养专家。当前正在与名为“${payload.userName}”的用户对话。请在回复中自然地称呼用户的名字。无论用户使用何种语言，你必须始终以中文回复。回复应专业、简练且充满正能量。`,
        });
        const result = await model.generateContent(payload.prompt);
        return res.status(200).json({ text: result.response.text() });
      }

      case 'analyzePhysique': {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { data: payload.base64Image, mimeType: 'image/jpeg' } },
              { text: "作为AI健身教练，分析这张体态照片。请评估：1. 视觉体脂率区间。2. 肌肉饱满度（1-10分）。3. 给出30字以内的针对性训练建议（中文）。以JSON返回。" }
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                visualBodyFat: { type: Type.STRING },
                muscleScore: { type: Type.NUMBER },
                advice: { type: Type.STRING },
                fitnessAgeAdjustment: { type: Type.NUMBER }
              },
              required: ['visualBodyFat', 'muscleScore', 'advice', 'fitnessAgeAdjustment']
            }
          }
        });
        return res.status(200).json(JSON.parse(result.response.text()));
      }

      case 'getHealthInsights': {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
        const diff = payload.profile.weight - payload.profile.targetWeight;
        const prompt = `用户信息：${JSON.stringify(payload.profile)}。当前体重${payload.profile.weight}kg，目标${payload.profile.targetWeight}kg，差距${Math.abs(diff)}kg。请提供：1. 预测体龄。2. 下周具体健康动作。3. 预计达成目标周数。以JSON返回。`;
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                fitnessAge: { type: Type.NUMBER },
                nextGoal: { type: Type.STRING },
                weeksToTarget: { type: Type.NUMBER }
              },
              required: ['fitnessAge', 'nextGoal', 'weeksToTarget']
            }
          }
        });
        return res.status(200).json(JSON.parse(result.response.text()));
      }

      case 'generateWeeklyPlan': {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });
        const prompt = `基于用户信息：${JSON.stringify(payload.userProfile)} 和最近记录：${JSON.stringify(payload.recentWorkouts)}。生成7天健身与饮食计划。要求在第一天以教练身份向名为“${payload.userProfile.name}”的用户致意。返回格式为 JSON 数组。`;
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.STRING },
                  workout: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, details: { type: Type.STRING } }, required: ['title', 'details'] },
                  meals: { type: Type.OBJECT, properties: { breakfast: { type: Type.STRING }, lunch: { type: Type.STRING }, dinner: { type: Type.STRING } }, required: ['breakfast', 'lunch', 'dinner'] }
                },
                required: ['day', 'workout', 'meals']
              }
            }
          }
        });
        return res.status(200).json(JSON.parse(result.response.text()));
      }

      case 'analyzeMealImage': {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
        const result = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { data: payload.base64Image, mimeType: 'image/jpeg' } },
              { text: `识别这张食物照片。给出名称、卡路里、蛋白质、碳水、脂肪。并以教练身份给名为“${payload.userName}”的用户写一段50字以内专业点评（中文）。称呼其名字。以JSON返回。` }
            ]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER },
                healthScore: { type: Type.NUMBER },
                coachTip: { type: Type.STRING }
              },
              required: ['name', 'calories', 'protein', 'carbs', 'fat', 'healthScore', 'coachTip']
            }
          }
        });
        return res.status(200).json(JSON.parse(result.response.text()));
      }

      case 'generateTTS': {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-tts" });
        const result = await model.generateContent({
          contents: [{ parts: [{ text: payload.text }] }],
          generationConfig: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: payload.voiceName } } }
          }
        });
        const audioData = result.response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        return res.status(200).json({ audioData });
      }

      case 'generateImage': {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' });
        const result = await model.generateContent({
          contents: [{ parts: [{ text: payload.prompt }] }],
          generationConfig: {
            imageConfig: { aspectRatio: payload.aspectRatio, imageSize: payload.imageSize }
          }
        });
        const imageData = result.response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
        return res.status(200).json({ imageData: imageData ? `data:image/png;base64,${imageData}` : null });
      }

      case 'generateVideo': {
        // Veo 视频生成逻辑
        let operation = await genAI.getGenerativeModel({ model: 'veo-3.1-fast-generate-preview' }).generateVideos({
          prompt: payload.prompt,
          image: { imageBytes: payload.base64Image, mimeType: 'image/jpeg' }
        });
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          operation = await genAI.operations.getVideosOperation({ operation });
        }
        const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
        // 中转视频流以隐藏密钥
        const videoRes = await fetch(`${videoUri}&key=${process.env.GEMINI_API_KEY}`);
        const buffer = await videoRes.arrayBuffer();
        return res.status(200).send(Buffer.from(buffer));
      }

      default:
        return res.status(400).json({ error: 'Unsupported action' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}