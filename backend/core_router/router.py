import os
import json
import time
from typing import List, Dict, Optional
import openai
from anthropic import Anthropic
import google.generativeai as genai
from groq import Groq
from loguru import logger

from backend.core_router.models import LLMConfig, LLMProvider, APIKeyInstance

# Persistent storage path for API keys
KEYS_FILE = os.getenv("API_KEYS_FILE", "/workspace/api_keys.json")


class LLMRouter:
    """
    Multi-provider LLM router with intelligent failover and persistent key storage.
    Supports unlimited API keys per provider with round-robin + rate-limit-aware rotation.
    """
    
    def __init__(self, config: LLMConfig):
        self.config = config
        self._load_keys_from_file()
    
    # ─── Persistent Key Storage ──────────────────────────────────
    
    def _load_keys_from_file(self):
        """Load API keys from persistent JSON file."""
        if os.path.exists(KEYS_FILE):
            try:
                with open(KEYS_FILE, "r") as f:
                    data = json.load(f)
                for provider_str, keys in data.items():
                    try:
                        provider = LLMProvider(provider_str)
                    except ValueError:
                        continue
                    for key_data in keys:
                        instance = APIKeyInstance(
                            name=key_data["name"],
                            key=key_data["key"],
                            provider=provider,
                            model_name=key_data.get("model_name"),
                            active=key_data.get("active", True),
                        )
                        if provider not in self.config.instances:
                            self.config.instances[provider] = []
                        # Avoid duplicates
                        existing_names = [i.name for i in self.config.instances[provider]]
                        if instance.name not in existing_names:
                            self.config.instances[provider].append(instance)
                logger.info(f"Loaded API keys from {KEYS_FILE}")
            except Exception as e:
                logger.error(f"Failed to load keys from {KEYS_FILE}: {e}")
    
    def _save_keys_to_file(self):
        """Persist API keys to JSON file."""
        try:
            os.makedirs(os.path.dirname(KEYS_FILE) or ".", exist_ok=True)
            data = {}
            for provider, instances in self.config.instances.items():
                data[provider.value] = [
                    {
                        "name": inst.name,
                        "key": inst.key,
                        "model_name": inst.model_name,
                        "active": inst.active,
                    }
                    for inst in instances
                ]
            with open(KEYS_FILE, "w") as f:
                json.dump(data, f, indent=2)
            logger.info(f"Saved API keys to {KEYS_FILE}")
        except Exception as e:
            logger.error(f"Failed to save keys: {e}")
    
    # ─── Key Management ──────────────────────────────────────────
    
    def add_api_key(self, provider: LLMProvider, name: str, key: str, model_name: Optional[str] = None) -> APIKeyInstance:
        """Add an API key instance and persist."""
        instance = APIKeyInstance(
            name=name, key=key, provider=provider,
            model_name=model_name, active=True
        )
        if provider not in self.config.instances:
            self.config.instances[provider] = []
        
        # Replace if same name exists
        self.config.instances[provider] = [
            i for i in self.config.instances[provider] if i.name != name
        ]
        self.config.instances[provider].append(instance)
        self._save_keys_to_file()
        logger.info(f"Added API key '{name}' for provider {provider.value}")
        return instance
    
    def remove_api_key(self, provider: LLMProvider, name: str) -> bool:
        """Remove an API key by provider and name."""
        if provider not in self.config.instances:
            return False
        before = len(self.config.instances[provider])
        self.config.instances[provider] = [
            i for i in self.config.instances[provider] if i.name != name
        ]
        if len(self.config.instances[provider]) < before:
            self._save_keys_to_file()
            return True
        return False
    
    def list_keys(self) -> Dict[str, list]:
        """List all keys with masked values."""
        result = {}
        for provider, instances in self.config.instances.items():
            result[provider.value] = [
                {
                    "name": inst.name,
                    "masked_key": inst.key[:8] + "..." + inst.key[-4:] if len(inst.key) > 12 else "***",
                    "model_name": inst.model_name,
                    "active": inst.active,
                    "request_count": inst.request_count,
                    "error_count": inst.error_count,
                    "last_used": inst.last_used,
                }
                for inst in instances
            ]
        return result
    
    def validate_key(self, provider: LLMProvider, key: str, model_name: Optional[str] = None) -> Dict:
        """Test if an API key is valid by making a minimal request."""
        try:
            if provider == LLMProvider.GROQ:
                client = Groq(api_key=key)
                resp = client.chat.completions.create(
                    model=model_name or "llama-3.3-70b-versatile",
                    messages=[{"role": "user", "content": "Hi"}],
                    max_tokens=5, temperature=0
                )
                return {"valid": True, "model": resp.model, "message": "Key is valid"}
            elif provider == LLMProvider.OPENAI:
                client = openai.OpenAI(api_key=key)
                resp = client.chat.completions.create(
                    model=model_name or "gpt-4o-mini",
                    messages=[{"role": "user", "content": "Hi"}],
                    max_tokens=5, temperature=0
                )
                return {"valid": True, "model": resp.model, "message": "Key is valid"}
            elif provider == LLMProvider.ANTHROPIC:
                client = Anthropic(api_key=key)
                resp = client.messages.create(
                    model=model_name or "claude-3-5-sonnet-20241022",
                    max_tokens=5, temperature=0,
                    messages=[{"role": "user", "content": "Hi"}]
                )
                return {"valid": True, "model": resp.model, "message": "Key is valid"}
            elif provider == LLMProvider.GEMINI:
                genai.configure(api_key=key)
                model = genai.GenerativeModel(model_name or "gemini-1.5-pro")
                resp = model.generate_content("Hi", generation_config=genai.types.GenerationConfig(max_output_tokens=5))
                return {"valid": True, "model": model_name or "gemini-1.5-pro", "message": "Key is valid"}
            elif provider == LLMProvider.OPENROUTER:
                client = openai.OpenAI(base_url="https://openrouter.ai/api/v1", api_key=key)
                resp = client.chat.completions.create(
                    model=model_name or "anthropic/claude-3.5-sonnet",
                    messages=[{"role": "user", "content": "Hi"}],
                    max_tokens=5, temperature=0
                )
                return {"valid": True, "model": resp.model, "message": "Key is valid"}
            else:
                return {"valid": False, "message": f"Unknown provider: {provider}"}
        except Exception as e:
            error_str = str(e)
            if "rate_limit" in error_str.lower() or "429" in error_str:
                return {"valid": True, "message": "Key is valid but currently rate-limited"}
            return {"valid": False, "message": f"Invalid key: {error_str[:200]}"}
    
    # ─── Completion ──────────────────────────────────────────────
    
    def complete(self, messages: List[Dict[str, str]], system_prompt: Optional[str] = None, max_tokens: int = 2000, temperature: float = 0.7) -> str:
        """Generate completion with round-robin rotation across all providers and keys."""
        providers = self._get_provider_order()
        last_error = None
        attempted = 0
        
        for provider in providers:
            if provider not in self.config.instances:
                continue
            
            for instance in self.config.instances[provider]:
                if not instance.active:
                    continue
                
                attempted += 1
                try:
                    response = self._call_provider(
                        provider=provider, instance=instance,
                        messages=messages, system_prompt=system_prompt,
                        max_tokens=max_tokens, temperature=temperature
                    )
                    
                    instance.request_count += 1
                    instance.last_used = time.time()
                    return response
                    
                except Exception as e:
                    last_error = e
                    instance.error_count += 1
                    error_str = str(e)
                    logger.warning(f"Provider {provider.value} key '{instance.name}' failed: {error_str[:150]}")
                    
                    if "rate_limit" in error_str.lower() or "429" in error_str:
                        # Rate limited — try next key/provider
                        continue
                    if "context_length" in error_str.lower() or "too long" in error_str.lower():
                        if provider != LLMProvider.GEMINI:
                            break  # Skip to next provider (Gemini has larger context)
                    # For other errors, try next key
                    continue
        
        if attempted == 0:
            raise Exception("No API keys configured. Please add API keys through the Settings > API Keys panel.")
        raise Exception(f"All LLM providers failed after {attempted} attempts. Last error: {last_error}")
    
    def _get_provider_order(self) -> List[LLMProvider]:
        all_providers = list(LLMProvider)
        if self.config.preferred_provider:
            if self.config.preferred_provider in all_providers:
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
        response = client.chat.completions.create(model=model or "gpt-4o", messages=messages, max_tokens=max_tokens, temperature=temp)
        return response.choices[0].message.content
    
    def _call_anthropic(self, api_key: str, messages: List[Dict], system: Optional[str], max_tokens: int, temp: float, model: Optional[str]) -> str:
        client = Anthropic(api_key=api_key)
        response = client.messages.create(model=model or "claude-3-5-sonnet-20241022", max_tokens=max_tokens, temperature=temp, system=system or "", messages=messages)
        return response.content[0].text
    
    def _call_groq(self, api_key: str, messages: List[Dict], system: Optional[str], max_tokens: int, temp: float, model: Optional[str]) -> str:
        client = Groq(api_key=api_key)
        if system: messages = [{"role": "system", "content": system}] + messages
        response = client.chat.completions.create(model=model or "llama-3.3-70b-versatile", messages=messages, max_tokens=max_tokens, temperature=temp)
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
        if system: messages = [{"role": "system", "content": system}] + messages
        response = client.chat.completions.create(model=model or "anthropic/claude-3.5-sonnet", messages=messages, max_tokens=max_tokens, temperature=temp)
        return response.choices[0].message.content