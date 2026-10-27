export type SiteExample = {
  id: string;
  title: string;
  source: string;
};

/** Website gallery. English-only; library fixtures may still contain Chinese. */
export const SITE_EXAMPLES: SiteExample[] = [
  {
    id: "01_agent_loop",
    title: "Robot agent control loop",
    source: `---
title: Robot agent control loop
---
flowchart TD
    %% planner -> controller -> VLA -> arm
    P["VLM planner<br/>next_subtask()"]:::model --> C["LeRobot<br/>RolloutController.set_task"]
    C --> V[[WALL VLA]]:::model
    V --> ARM["single arm + wrist cam"]:::focus
    ARM --> J{ARBITRATION}
    J -- success --> P
    J -. fail / retry .-> C
    subgraph ELEV [ELEVATOR]
        direction LR
        W([WAITING]) --> L[LIGHT ON]
        L --> D[LASER DOOR-OPEN]
        D --> E[ENTERING]
    end
    P -->|subtask = ride elevator| W
    E -.-> J
    classDef model fill:#9DC1F7
    classDef focus fill:#1F6FEB,color:#fff
`,
  },
  {
    id: "02_subgraphs",
    title: "Nested subgraphs · data / train / serve",
    source: `flowchart LR
    subgraph DATA [DATA]
        subgraph REC [RECORD]
            T[teleop] --> EP[(episodes)]
        end
        EP --> CL[CLEAN]
    end
    subgraph TRAIN [TRAINING]
        CL --> FT[FINE-TUNE]:::hatch
        FT --> EV{EVAL}
    end
    subgraph SERVE [SERVING]
        Q[QUANTIZE] --> SRV[VLA SERVER]
    end
    EV -->|pass| Q
    EV -. fail .-> T
    SRV ==> R((ROBOT))
`,
  },
  {
    id: "03_fanout",
    title: "Control-plane fan-out",
    source: `graph LR
    CP[CONTROL PLANE] --> W1[WORKER 1 SHANGHAI] & W2[WORKER 2 SHENZHEN] & W3[WORKER 3 EDGE]
    CP -.-> W4[WORKER 4 STANDBY]
    W1 & W2 & W3 --> M[(METRICS)]
`,
  },
  {
    id: "04_classdef",
    title: "classDef / style mapping",
    source: `flowchart TB
    CAM[CAMERA] --> ENC[visual ENCODER]
    ENC --> POL[VLA POLICY]
    POL --> ACT[ACTION CHUNK]
    ACT --> CTRL[CONTROLLER]
    SAFE[SAFETY] -.-> CTRL
    classDef focus fill:#0B3D91,stroke:#0B3D91,color:#fff
    classDef hatch fill:#DCE9FD
    classDef opt stroke-dasharray: 5 5
    class POL focus
    class ENC hatch
    class SAFE opt
    style CAM fill:#fff
`,
  },
  {
    id: "05_sequence",
    title: "Operator · agent · arm",
    source: `sequenceDiagram
    autonumber
    actor U as Operator
    participant A as Agent (VLM)
    participant S as VLA Server
    participant R as Robot arm
    U->>A: put the cup in the basket
    A->>S: set_task("pick cup")
    loop every 100 ms / every chunk
        R-->>S: obs (RGB + proprio)
        S->>R: action chunk
    end
    alt success
        R-->>A: done
    else fail
        R--)A: error + snapshot
        A->>A: replan
    end
    Note over A,S: report after the subtask
    A-->>U: done
`,
  },
  {
    id: "06_messy",
    title: "Wrapping and back-edges",
    source: `flowchart TD
    A["A very long label that keeps going and going to test wrapping inside one node"] --> B
    A --> C[A second node with a very long English label to check automatic wrapping]
    B --> D
    C --> D
    A --> D
    B --> E[E]
    C --> E
    D --> F{"decision with a long question?"}
    E --> F
    F -->|yes, continue with the main path| G
    F -->|no| A
    G --> B
    E -.-> C
    D ==> G
`,
  },
  {
    id: "07_state",
    title: "Elevator state machine",
    source: `stateDiagram-v2
    [*] --> Waiting
    state "WAITING" as Waiting
    state "LIGHT ON" as LightOn
    state "DOOR OPEN" as DoorOpen
    state "ENTERING" as Entering
    Waiting --> LightOn : button light on
    LightOn --> DoorOpen : laser distance above threshold
    DoorOpen --> Entering : door held open
    DoorOpen --> Waiting : timeout
    Entering --> [*]
`,
  },
  {
    id: "08_pie",
    title: "Pets pie chart",
    source: `pie showData
    title Pets adopted
    "Dogs" : 386
    "Cats" : 85
    "Rats" : 35
`,
  },
  {
    id: "09_shapes_edges",
    title: "Shapes and edge marks",
    source: `flowchart LR
    A[rect] --> B(round) --> C([stadium]) --> D[[subroutine]]
    D --> E((circle)) --> F[(database)]
    F --> G{{hexagon}} --> H>flag] --> I[/para/]
    A --- J[no arrow head]
    A <--> K[both]
    K -- text --- L[plain line]
    L == heavy ==> M[thick]
    M -. maybe .-> N[dashed]
    N --o O[circle head]
    O --x P[cross head]
`,
  },
  {
    id: "10_math",
    title: "KaTeX in node and edge labels",
    source: `---
title: Loss and softmax
---
flowchart TD
    L["$$\\mathcal{L} = -\\sum_i y_i \\log \\hat{y}_i$$"] --> S["$$p_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}$$"]
    S --> G["gradient $\\nabla_\\theta \\mathcal{L}$"]
    G -- "$\\eta = 10^{-3}$" --> X["area $x^2$"]
    X --> L
`,
  },
];
