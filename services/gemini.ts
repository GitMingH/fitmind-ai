// fitmind-ai/services/gemini.ts
export const geminiService = {
  async callProxy(action: string, payload: any) {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload })
    });
    if (!response.ok) throw new Error('AI 服务响应异常');
    return response.json();
  },

  async getQuickTip(prompt: string, userName: string = "小明") {
    const data = await this.callProxy('getQuickTip', { prompt, userName });
    return data.text;
  },

  async analyzePhysique(base64Image: string) {
    return this.callProxy('analyzePhysique', { base64Image });
  },

  async getHealthInsights(profile: any) {
    return this.callProxy('getHealthInsights', { profile });
  },

  async generateWeeklyPlan(userProfile: any, recentWorkouts: any[]) {
    return this.callProxy('generateWeeklyPlan', { userProfile, recentWorkouts });
  },

  async analyzeMealImage(base64Image: string, userName: string = "小明") {
    return this.callProxy('analyzeMealImage', { base64Image, userName });
  },

  async generateGuidanceSpeech(text: string, voiceName: string = 'Kore') {
    const data = await this.callProxy('generateTTS', { text, voiceName });
    return data.audioData;
  },

  async generateInspirationImage(prompt: string, aspectRatio: string = "1:1", imageSize: string = "1K") {
    const data = await this.callProxy('generateImage', { prompt, aspectRatio, imageSize });
    return data.imageData;
  },

  async generateVeoVideo(prompt: string, base64Image: string) {
    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'generateVideo', payload: { prompt, base64Image } })
    });
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }
};