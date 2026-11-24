import { Config } from "@remotion/cli/config";

// remotion/MonoFx.tsx uses WebGL effects; Studio and CLI renders need the ANGLE backend for them.
Config.setChromiumOpenGlRenderer("angle");
