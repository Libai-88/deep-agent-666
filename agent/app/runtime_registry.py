from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterator

from copilotkit import LangGraphAGUIAgent

from app.agent_factory import available_presets, build_langgraph_agents, build_v2_coordinator
from app.config import AgentSettings
from app.permissions import PermissionMode
from app.presets import AgentPreset
from app.provider_registry import ProviderRegistrySnapshot, load_provider_registry_from_settings


@dataclass(frozen=True)
class RuntimeAgentRegistry:
    provider_registry_snapshot: ProviderRegistrySnapshot
    presets_by_id: dict[str, AgentPreset]
    v1_agents: dict[str, LangGraphAGUIAgent]
    coordinator_agents: dict[str, LangGraphAGUIAgent]

    @property
    def all_agents(self) -> list[LangGraphAGUIAgent]:
        return list(self.v1_agents.values()) + list(self.coordinator_agents.values())

    @property
    def route_agents(self) -> dict[str, LangGraphAGUIAgent]:
        return {
            **self.v1_agents,
            **self.coordinator_agents,
        }


class LiveAgentAccessor:
    def __init__(self, getter: Callable[[], RuntimeAgentRegistry]) -> None:
        self._getter = getter

    def __call__(self, _context) -> list[LangGraphAGUIAgent]:
        return self._getter().all_agents

    def __iter__(self) -> Iterator[LangGraphAGUIAgent]:
        return iter(self._getter().all_agents)


def build_runtime_registry(
    settings: AgentSettings,
    provider_registry_snapshot: ProviderRegistrySnapshot | None = None,
) -> RuntimeAgentRegistry:
    snapshot = provider_registry_snapshot or load_provider_registry_from_settings(settings)
    presets_by_id = available_presets(settings, snapshot)
    v1_agents = build_langgraph_agents(settings, snapshot)

    coordinator_agents: dict[str, LangGraphAGUIAgent] = {}
    for preset_id, preset in presets_by_id.items():
        if preset.permission_mode not in (PermissionMode.BALANCED, PermissionMode.FULL_ACCESS):
            continue

        v2_model = preset.model.replace(":", "/", 1)
        try:
            coord_graph = build_v2_coordinator(
                model=v2_model,
                permission_mode=preset.permission_mode.value,
                settings=settings,
                provider_id=preset.provider_id or _preset_provider_id(preset),
                registry_snapshot=snapshot,
            )
            coordinator_agents[f"coordinator-{preset_id}"] = LangGraphAGUIAgent(
                name=f"coordinator-{preset_id}",
                description=f"Coordinator ({preset.label})",
                graph=coord_graph,
            )
        except ValueError:
            continue

    return RuntimeAgentRegistry(
        provider_registry_snapshot=snapshot,
        presets_by_id=presets_by_id,
        v1_agents=v1_agents,
        coordinator_agents=coordinator_agents,
    )


def _preset_provider_id(preset: AgentPreset) -> str:
    return preset.provider_id or preset.model.split(":", maxsplit=1)[0]
