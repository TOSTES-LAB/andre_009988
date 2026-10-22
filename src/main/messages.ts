export const MCP_CONNECTION_LOST =
  "Retry the tool call once only when it is safe to repeat or known not to have started. If it may already have changed the target, or it fails again, tell the user QORVEX lost its MCP client connection and ask them to restart the MCP client.";
export const MCP_CONNECTION_START_FAILED =
  "Retry once. If it fails again, tell the user QORVEX could not start its MCP connection and ask them to restart the MCP client, then run `qorvex doctor`.";
export const MCP_SHUTDOWN_FAILED =
  "QORVEX could not close cleanly. End the QORVEX process before starting it again.";
export const SERVER_START_FAILED =
  "Do not repeat this startup. Tell the user QORVEX could not start and ask them to restart the MCP client, then run `qorvex doctor`.";
export const MCP_HTTP_LISTEN_FAILED =
  "QORVEX could not listen for MCP HTTP connections on the selected host and port. Choose another --port or stop the process using it.";
