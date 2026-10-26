export type GalleryItem = {
  id: string;
  title: string;
  source: string;
};

export const GALLERY: GalleryItem[] = [
  {
    id: "01_agent_loop",
    title: "Robot agent control loop",
    source: `---
title: 机器人 Agent 控制回路
---
flowchart TD
    %% planner -> controller -> VLA -> arm
    P["VLM 规划器<br/>next_subtask()"]:::model --> C["LeRobot<br/>RolloutController.set_task"]
    C --> V[[WALL VLA]]:::model
    V --> ARM["单臂 + 腕部相机<br/>single arm + wrist cam"]:::focus
    ARM --> J{仲裁 ARBITRATION}
    J -- success --> P
    J -. fail / retry .-> C
    subgraph ELEV [电梯状态机 ELEVATOR]
        direction LR
        W([等待 WAITING]) --> L[灯亮 LIGHT ON]
        L --> D[激光测门开 LASER DOOR-OPEN]
        D --> E[进入 ENTERING]
    end
    P -->|子任务 = 乘电梯| W
    E -.-> J
    classDef model fill:#9DC1F7
    classDef focus fill:#1F6FEB,color:#fff
`,
  },
  {
    id: "02_subgraphs",
    title: "Nested subgraphs · data / train / serve",
    source: `flowchart LR
    subgraph DATA [数据 DATA]
        subgraph REC [采集 RECORD]
            T[遥操作 teleop] --> EP[(episodes)]
        end
        EP --> CL[清洗 CLEAN]
    end
    subgraph TRAIN [训练 TRAINING]
        CL --> FT[微调 FINE-TUNE]:::hatch
        FT --> EV{评测 EVAL}
    end
    subgraph SERVE [部署 SERVING]
        Q[量化 QUANTIZE] --> SRV[VLA SERVER]
    end
    EV -->|通过 pass| Q
    EV -. 不通过 fail .-> T
    SRV ==> R((ROBOT))
`,
  },
  {
    id: "03_fanout",
    title: "Control-plane fan-out",
    source: `graph LR
    CP[控制平面 CONTROL PLANE] --> W1[WORKER 1 上海] & W2[WORKER 2 深圳] & W3[WORKER 3 EDGE]
    CP -.-> W4[WORKER 4 STANDBY]
    W1 & W2 & W3 --> M[(METRICS)]
`,
  },
  {
    id: "04_classdef",
    title: "classDef / style mapping",
    source: `flowchart TB
    CAM[相机 CAMERA] --> ENC[视觉编码器 ENCODER]
    ENC --> POL[VLA POLICY]
    POL --> ACT[动作块 ACTION CHUNK]
    ACT --> CTRL[底层控制 CONTROLLER]
    SAFE[安全监控 SAFETY] -.-> CTRL
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
    actor U as 操作员
    participant A as Agent (VLM)
    participant S as VLA Server
    participant R as Robot 机械臂
    U->>A: 把杯子放进篮子
    A->>S: set_task("pick cup")
    loop 每 100 ms / every chunk
        R-->>S: 观测 obs (RGB + proprio)
        S->>R: action chunk
    end
    alt 成功 success
        R-->>A: done
    else 失败 fail
        R--)A: error + 截图
        A->>A: 重新规划 replan
    end
    Note over A,S: 子任务完成后上报 report
    A-->>U: 完成 done
`,
  },
  {
    id: "06_messy",
    title: "Wrapping and back-edges",
    source: `flowchart TD
    A["A very long label that keeps going and going to test wrapping inside one node"] --> B
    A --> C[第二个节点有一个非常长的中文标签用于测试自动换行是否正常工作]
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
    state "等待 WAITING" as Waiting
    state "灯亮 LIGHT ON" as LightOn
    state "激光测门开 DOOR OPEN" as DoorOpen
    state "进入 ENTERING" as Entering
    Waiting --> LightOn : 按钮灯亮
    LightOn --> DoorOpen : 激光距离 > 阈值
    DoorOpen --> Entering : 门开稳定
    DoorOpen --> Waiting : 超时 timeout
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
    D --> E((circle)) --> F[(数据库 db)]
    F --> G{{hexagon}} --> H>flag] --> I[/para/]
    A --- J[无箭头 no head]
    A <--> K[双向 both]
    K -- 文本 text --- L[plain line]
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
    G -- "$\\eta = 10^{-3}$" --> L
`,
  },
];
