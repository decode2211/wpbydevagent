"""
LangGraph configuration and compilation.
Wires up the acknowledge, context_retriever, llm_reasoning, and dispatcher nodes.
"""

from langgraph.graph import StateGraph, START, END
from agent.state import AgentState
from agent.nodes import (
    acknowledge_node,
    context_retriever_node,
    llm_reasoning_node,
    dispatcher_node,
)


def build_agent_graph() -> StateGraph:
    """
    Sets up the StateGraph workflow, links the nodes, and compiles the flow.
    Flow direction: START -> acknowledge -> context_retriever -> llm_reasoning -> dispatcher -> END.
    """
    # Create the graph mapping state
    graph = StateGraph(AgentState)

    # Register each active node
    graph.add_node("acknowledge", acknowledge_node)
    graph.add_node("context_retriever", context_retriever_node)
    graph.add_node("llm_reasoning", llm_reasoning_node)
    graph.add_node("dispatcher", dispatcher_node)

    # Connect nodes linearly
    graph.add_edge(START, "acknowledge")
    graph.add_edge("acknowledge", "context_retriever")
    graph.add_edge("context_retriever", "llm_reasoning")
    graph.add_edge("llm_reasoning", "dispatcher")
    graph.add_edge("dispatcher", END)

    # Compile the flow
    return graph.compile()


# Export the compiled orchestration graph
agent_graph = build_agent_graph()
