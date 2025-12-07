// src/types/openAiResponse.d.ts

export interface OpenAiChoice {
    text: string;
    index: number;
    logprobs: any;
    finish_reason: string;
}

export interface OpenAiResponse {
    choices: OpenAiChoice[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}
