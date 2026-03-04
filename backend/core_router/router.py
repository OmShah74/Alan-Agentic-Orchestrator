import time
from typing import List, Dict, Optional, Any
import openai
from anthropic import Anthropic
import google.generativeai as genai
from groq import Groq
from loguru import logger

from backend.core_router.models import LLMConfig, LLMProvider, APIKeyInstance

class LLMRouter:
    """
    Multi-provider LLM router with intelligent fallback.
    Implements smart routing, rate limit handling, and context overflow handling.
    """
    
    def __init__(self, config: LLMConfig):
        self.config = config
        
    def add_api_key(self, provider: LLMProvider, name: str, key: str, model_name: Optional[str] = None):
        """Add an API key instance"""
        instance = APIKeyInstance(
            name=name,
            key=key,
            provider=provider,
            model_name=model_name,
            active=True
        )
        if provider not in self.config.instances:
            self.config.instances[provider] =[]
        
        self.config.instances[provider].append(instance)
        logger.info(f"Added API key '{name}' for provider {provider.value}")
    
    def complete(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None, max_tokens: int = 2000, temperature: float = 0.7) -> str:
        """Generate completion with automatic fallback"""
        providers = self._get_provider_order()
        last_error = None
        
        for provider in providers:
            if provider not in self.config.instances:
                continue
            
            for instance in self.config.instances[provider]:
                if not instance.active:
                    continue
                
                try:
                    response = self._call_provider(
                        provider=provider,
                        instance=instance,
                        messages=messages,
                        system_prompt=system_prompt,
                        max_tokens=max_tokens,
                        temperature=temperature
                    )
                    
                    instance.request_count += 1
                    instance.last_used = time.time()
                    return response
                    
                except Exception as e:
                    last_error = e
                    instance.error_count += 1
                    logger.warning(f"Provider {provider.value} key '{instance.name}' failed: {e}")
                    
                    if "rate_limit" in str(e).lower() or "429" in str(e):
                        continue
                    if "context_length" in str(e).lower() or "too long" in str(e).lower():
                        if provider != LLMProvider.GEMINI:
                            break  
        
        raise Exception(f"All LLM providers failed. Last error: {last_error}")
    
    def _get_provider_order(self) -> List[LLMProvider]:
        all_providers = list(LLMProvider)
        if self.config.preferred_provider:
            all_providers.remove(self.config.preferred_provider)
            all_providers.insert(0, self.config.preferred_provider)
        return all_providers
    
    def _call_provider(self, provider: LLMProvider, instance: APIKeyInstance, messages: List[Dict], system_prompt: Optional[str], max_tokens: int, temperature: float) -> str:
        if provider == LLMProvider.OPENAI:
            return self._call_openai(instance.key, messages, system_prompt, max_tokens, temperature, instance.model_name)
        elif provider == LLMProvider.ANTHROPIC:
            return self._call_anthropic(instance.key, messages, system_prompt, max_tokens, temperature, instance.model_name)
        elif provider == LLMProvider.GROQ:
            return self._call_groq(instance.key, messages, system_prompt, max_tokens, temperature, instance.model_name)
        elif provider == LLMProvider.GEMINI:
            return self._call_gemini(instance.key, messages, system_prompt, max_tokens, temperature, instance.model_name)
        elif provider == LLMProvider.OPENROUTER:
            return self._call_openrouter(instance.key, messages, system_prompt, max_tokens, temperature, instance.model_name)
        else:
            raise ValueError(f"Unknown provider: {provider}")

    def _call_openai(self, api_key: str, messages: List[Dict], system: Optional[str], max_tokens: int, temp: float, model: Optional[str]) -> str:
        client = openai.OpenAI(api_key=api_key)
        if system: messages = [{"role": "system", "content": system}] + messages
        response = client.chat.completions.create(model=model or "gpt-4-turbo-preview", messages=messages, max_tokens=max_tokens, temperature=temp)
        return response.choices[0].message.content
    
    def _call_anthropic(self, api_key: str, messages: List[Dict], system: Optional[str], max_tokens: int, temp: float, model: Optional[str]) -> str:
        client = Anthropic(api_key=api_key)
        response = client.messages.create(model=model or "claude-3-5-sonnet-20241022", max_tokens=max_tokens, temperature=temp, system=system or "", messages=messages)
        return response.content[0].text
    
    def _call_groq(self, api_key: str, messages: List[Dict], system: Optional[str], max_tokens: int, temp: float, model: Optional[str]) -> str:
        client = Groq(api_key=api_key)
        if system: messages = [{"role": "system", "content": system}] + messages
        response = client.chat.completions.create(model=model or "mixtral-8x7b-32768", messages=messages, max_tokens=max_tokens, temperature=temp)
        return response.choices[0].message.content
    
    def _call_gemini(self, api_key: str, messages: List[Dict], system: Optional[str], max_tokens: int, temp: float, model_name: Optional[str]) -> str:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(model_name or 'gemini-1.5-pro')
        prompt = f"System: {system}\n\n" if system else ""
        for msg in messages: prompt += f"{msg['role'].capitalize()}: {msg['content']}\n\n"
        response = model.generate_content(prompt, generation_config=genai.types.GenerationConfig(max_output_tokens=max_tokens, temperature=temp))
        return response.text
    
    def _call_openrouter(self, api_key: str, messages: List[Dict], system: Optional[str], max_tokens: int, temp: float, model: Optional[str]) -> str:
        client = openai.OpenAI(base_url="https://openrouter.ai/api/v1", api_key=api_key)
        if system: messages =[{"role": "system", "content": system}] + messages
        response = client.chat.completions.create(model=model or "anthropic/claude-3.5-sonnet", messages=messages, max_tokens=max_tokens, temperature=temp)
        return response.choices[0].message.content