import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
  info: ErrorInfo | null;
}

export default class IpDetailErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[IpDetailErrorBoundary]", error, info);
    this.setState({ error, info });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="border border-red-500/40 bg-red-500/10 rounded p-3 text-[11px] font-mono text-red-200 whitespace-pre-wrap break-all space-y-2">
          <div className="font-semibold text-red-300">
            [Render-Fehler im IP Detail]
          </div>
          <div>
            <span className="text-red-300">message:</span> {this.state.error.message}
          </div>
          {this.state.error.stack && (
            <div>
              <span className="text-red-300">stack:</span>
              {"\n"}
              {this.state.error.stack.split("\n").slice(0, 8).join("\n")}
            </div>
          )}
          {this.state.info?.componentStack && (
            <div>
              <span className="text-red-300">component:</span>
              {"\n"}
              {this.state.info.componentStack.split("\n").slice(0, 6).join("\n")}
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
