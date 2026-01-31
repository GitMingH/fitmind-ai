
import { GoogleGenAI, Type, Modality } from "@google/genai";

// 增强型初始化：带错误检测
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.error("FitMind Error: API_KEY is missing in process.env. 请检查 Vercel 环境变量设置。");
  }
  return new GoogleGenAI({ apiKey: apiKey || "" });
};



export const geminiService = {
  // Get a quick fitness or nutrition tip
  async getQuickTip(prompt: string, userName: string = "用户") {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: `你是一位资深的健身与营养专家。当前正在与名为“${userName}”的用户对话。请在回复中自然地称呼用户的名字（如：${userName}，建议你...）。无论用户使用何种语言，你必须始终以中文回复。回复应专业、简练且充满正能量。`,
        }
      });
      return response.text;
    } catch (error: any) {
      console.error("AI Service Error (getQuickTip):", error);
      return `[系统提示] 抱歉 ${userName}，教练暂时无法回应（${error.message || '网络连接异常'}）。请检查 API Key 权限。`;
    }
  },

  // Analyze physique from a base64 image
  async analyzePhysique(base64Image: string) {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: "作为AI健身教练，分析这张体态照片。请评估：1. 视觉体脂率区间。2. 肌肉饱满度（1-10分）。3. 给出30字以内的针对性训练建议（中文）。以JSON返回。" }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              visualBodyFat: { type: Type.STRING },
              muscleScore: { type: Type.NUMBER },
              advice: { type: Type.STRING },
              fitnessAgeAdjustment: { type: Type.NUMBER, description: "基于照片调整的体龄偏移值，如 -2 或 +1" }
            },
            required: ['visualBodyFat', 'muscleScore', 'advice', 'fitnessAgeAdjustment']
          }
        }
      });
      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error("AI Service Error (analyzePhysique):", error);
      throw error;
    }
  },

  // Get health insights based on user profile
  async getHealthInsights(profile: any) {
    try {
      const ai = getAI();
      const diff = profile.weight - profile.targetWeight;
      const prompt = `用户信息：${JSON.stringify(profile)}。
      当前体重${profile.weight}kg，目标${profile.targetWeight}kg，差距${Math.abs(diff)}kg。
      请提供：1. 预测体龄。2. 下周具体健康动作。3. 预计达成目标周数（假设每周减0.5kg或增0.2kg）。以JSON返回。`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
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
      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error("AI Service Error (getHealthInsights):", error);
      return { fitnessAge: profile.age, nextGoal: "保持现状", weeksToTarget: 0 };
    }
  },

  // Generate an audio preview for coach personas
  async generatePersonaPreview(personaId: string, personaName: string) {
    try {
      const ai = getAI();
      const prompts: Record<string, string> = {
        encouraging: `Say cheerfully: 你好！我是你的${personaName}。我会一直陪伴你，见证你每一次流汗的瞬间，加油！`,
        strict: `Say firmly: 我是你的${personaName}。在这里没有借口，只有汗水。立刻动起来，不要挑战我的耐心。`,
        scientific: `Say professionally: 您好。我是您的${personaName}。我会通过精确的生理指标监测，为您构建最优化的运动能耗模型。`,
      };
      
      const voiceNames: Record<string, string> = {
        encouraging: 'Kore',
        strict: 'Fenrir',
        scientific: 'Charon',
      };

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompts[personaId] || prompts.encouraging }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceNames[personaId] || 'Kore' } }
          }
        }
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
      console.error("TTS Error:", error);
      return null;
    }
  },

  // Generic Voice Sample Generation for Library试听
  async generateVoiceSample(voiceName: string) {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `你好，我是 FitMind 的音色示例，我的名字叫 ${voiceName}。很高兴能为你提供专业的健身指导。` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } }
          }
        }
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
      console.error("TTS Sample Error:", error);
      return null;
    }
  },

  // Generate a weekly workout and meal plan
  async generateWeeklyPlan(userProfile: any, recentWorkouts: any[]) {
    try {
      const ai = getAI();
      const prompt = `基于以下用户信息：${JSON.stringify(userProfile)} 和最近记录：${JSON.stringify(recentWorkouts)}。
      任务：生成一份专业的7天健身与饮食计划。要求在第一天的建议中，以教练身份向名为“${userProfile.name}”的用户致意。返回格式必须是 JSON 数组，包含 day, workout(title, details), meals(breakfast, lunch, dinner)。`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                day: { type: Type.STRING },
                workout: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    details: { type: Type.STRING }
                  },
                  required: ['title', 'details']
                },
                meals: {
                  type: Type.OBJECT,
                  properties: {
                    breakfast: { type: Type.STRING },
                    lunch: { type: Type.STRING },
                    dinner: { type: Type.STRING }
                  },
                  required: ['breakfast', 'lunch', 'dinner']
                }
              },
              required: ['day', 'workout', 'meals']
            }
          }
        }
      });
      return JSON.parse(response.text || '[]');
    } catch (error) {
      console.error("Plan Generation Error:", error);
      throw error;
    }
  },

  // Analyze meal image for nutrition data
  async analyzeMealImage(base64Image: string, userName: string = "用户") {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: `识别这张食物照片。给出名称、估算的卡路里、蛋白质、碳水、脂肪（克）。同时给出一个 0-100 的健康分，并以教练身份给名为“${userName}”的用户写一段 50 字以内的专业点评（中文）。请务必称呼其名字。以 JSON 返回。` }
          ]
        },
        config: {
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
      return JSON.parse(response.text || '{}');
    } catch (error) {
      console.error("Meal Analysis Error:", error);
      throw error;
    }
  },

  // Edit an image based on a text prompt
  async editMealImage(base64Image: string, prompt: string) {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
            { text: prompt },
          ],
        },
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error) {
      console.error("Image Edit Error:", error);
      return null;
    }
  },

  // Generate speech for guidance using TTS
  async generateGuidanceSpeech(text: string, voiceName: string = 'Kore') {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
        },
      });
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
      console.error("Guidance TTS Error:", error);
      return null;
    }
  },

  // Generate high-quality images for AILab
  async generateInspirationImage(prompt: string, aspectRatio: string = "1:1", imageSize: string = "1K") {
    try {
      const ai = getAI();
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-image-preview',
        contents: { parts: [{ text: prompt }] },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: imageSize as any
          }
        },
      });
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      return null;
    } catch (error) {
      console.error("Image Generation Error:", error);
      throw error;
    }
  },

  // Generate videos using Veo 3.1
  async generateVeoVideo(prompt: string, base64Image: string) {
    try {
      const ai = getAI();
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: {
          imageBytes: base64Image,
          mimeType: 'image/jpeg',
        },
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });
      // Poll for video generation completion
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({operation: operation});
      }
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        // Append API key to fetch the video data
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
      }
      return null;
    } catch (error) {
      console.error("Veo Video Error:", error);
      throw error;
    }
  }
};
