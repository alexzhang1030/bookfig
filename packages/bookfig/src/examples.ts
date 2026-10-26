import { Fig } from "./fig.ts";

export function exampleLineArea(): Fig {
  const f = new Fig();
  const hrs = Array.from({ length: 25 }, (_, h) => h);
  const req = hrs.map((h) => 20 + 60 * Math.exp(-(((h - 14) / 4.2) ** 2)) + 6 * Math.sin(h * 1.7));
  const gpu = req.map((r) => Math.max(1, Math.ceil(r / 20)) * 20);
  f.lineChart(90, 70, 1820, 900, {
    series: [
      { xs: hrs, ys: req, area: "dots" },
      { xs: hrs, ys: gpu, style: "dashed", step: true },
    ],
    xlim: [0, 24],
    ylim: [0, 100],
    xticks: [0, 4, 8, 12, 16, 20, 24],
    yticks: [0, 25, 50, 75, 100],
    xlabel: "时间 TIME (H)",
    ylabel: "请求 REQUESTS",
    title: "机器人车队推理请求 · 示例数据",
    legend: [
      ["请求量", "solid"],
      ["GPU 数", "dashed"],
    ],
  });
  f.tag(340, 205, "EXAMPLE DATA 示例", 24, "plain");
  return f;
}

export function exampleBars(): Fig {
  const f = new Fig();
  f.barCompare(90, 70, 1820, {
    rows: [
      ["VLA-S", [42, 28, 19]],
      ["VLA-M", [88, 55, 36]],
      ["VLA-L", [160, 97, 64]],
    ],
    series: ["FP16", "FP8", "INT4"],
    title: "单步动作延迟对比 (MS) · 示例数据",
    unit: " ms",
  });
  f.text(1000, f.maxY + 50, "EXAMPLE DATA — NOT MEASURED", 26);
  return f;
}

export function exampleFormats(): Fig {
  const f = new Fig();
  f.barCompare(90, 70, 1820, {
    rows: [
      ["FP16", [1, 5, 10]],
      ["FP8", [1, 4, 3]],
      ["INT8", [1, 0, 7]],
      ["FP4", [1, 2, 1]],
      ["INT4", [1, 0, 3]],
    ],
    series: ["Sign 符号", "Exponent 指数", "Mantissa 尾数"],
    title: "Comparing number formats 数字格式",
    cells: true,
    fills: ["dark", "line", "mid"],
    labelW: 240,
  });
  return f;
}

export function exampleTable(): Fig {
  const f = new Fig();
  f.table(90, 70, 1820, {
    header: ["组件 COMPONENT", "运行位置 WHERE", "频率 RATE", "说明 NOTE"],
    rows: [
      ["VLM 规划器", "云端 GPU", "~1 HZ", "把任务拆成子目标，语言条件"],
      ["VLA 策略", "机载 JETSON", "~10 HZ", "图像 + 子目标 → 动作块 action chunk"],
      ["底层控制器", "MCU", "~1 KHZ", "关节力矩 / 位置闭环"],
      ["安全监控", "MCU", "~1 KHZ", "急停、限位、碰撞检测"],
    ],
    colW: [3, 3, 2, 6],
    focusCol: 1,
    align: ["middle", "middle", "middle", "start"],
    title: "机器人推理栈分层 · 示例",
  });
  f.text(1000, f.maxY + 50, "频率为示例数据 / RATES ARE EXAMPLE VALUES", 26);
  return f;
}

export function examplePipeline(): Fig {
  const f = new Fig();
  f.title("VLA 推理流水线 PIPELINE");
  const y = 380;
  const h = 200;
  f.group(80, 290, 600, 380, "感知 PERCEPTION");
  f.group(780, 290, 660, 380, "推理 REASONING");
  f.group(1540, 290, 380, 380, "执行 ACTION");
  const cam = f.box(110, y, 200, h, "相机 RGB-D", { sub: "30 FPS" });
  const enc = f.box(370, y, 280, h, "视觉编码器", { kind: "hatch" });
  const vlm = f.box(820, y, 270, h, "VLM 规划器", { kind: "hatch" });
  const vla = f.box(1140, y, 260, h, "VLA 策略", { kind: "hatch" });
  const arm = f.box(1580, y, 300, h, "机械臂控制", { kind: "focus", sub: "ACTION CHUNK" });
  f.arrow(cam.r, enc.l);
  f.arrow(enc.r, vlm.l);
  f.arrow(vlm.r, vla.l);
  f.arrow(vla.r, arm.l);
  const pr = f.box(860, 800, 440, 110, "任务指令 PROMPT", { kind: "plain" });
  f.elbow([pr.cx - 90, pr.y], [vlm.cx, vlm.bottom], "solid", "v", 735);
  f.elbow([pr.cx + 90, pr.y], [vla.cx, vla.bottom], "dashed", "v", 735);
  f.polyline(
    [
      [arm.right - 40, arm.y],
      [arm.right - 40, 220],
      [vla.cx + 60, 220],
      [vla.cx + 60, vla.y],
    ],
    "dashed",
  );
  f.text(1550, 190, "本体状态 ASYNC", 26);
  return f;
}

export function exampleFanout(): Fig {
  const f = new Fig();
  f.title("CONTROL PLANE → WORKER PLANES");
  const cp = f.box(120, 380, 520, 240, "控制平面 CONTROL PLANE");
  const subs = ["上海 · 4× GPU", "深圳 · 2× GPU", "机器人现场 EDGE", "备用 STANDBY"];
  const ws = subs.map((s, i) =>
    f.box(1260, 220 + i * 150, 560, 110, `WORKER PLANE ${i + 1}`, { sub: s }),
  );
  f.fanOut(cp, ws.slice(0, 3), undefined, 950);
  f.fanOut(cp, ws.slice(3), ["dashed"], 950);
  f.group(1220, 190, 640, 620, "WORKER PLANES 工作平面", "center", false);
  return f;
}

export function exampleTraffic(): Fig {
  const f = new Fig();
  f.title("灰度发布 CANARY TRAFFIC SPLIT");
  const tr = f.box(120, 400, 300, 130, "TRAFFIC 流量");
  const old = f.box(1100, 230, 760, 190, "OLD DEPLOYMENT", { sub: "VLA v1 · 90%" });
  const neu = f.box(1100, 520, 760, 190, "NEW DEPLOYMENT", { kind: "group", sub: "VLA v2 · 10%" });
  const ys = [tr.cy - 30, tr.cy - 10, tr.cy + 10];
  ys.forEach((yy, i) => {
    f.elbow([tr.right, yy], [old.x, old.cy - 40 + i * 40], "solid", "h", 600 + i * 40);
  });
  f.elbow([tr.right, tr.cy + 30], [neu.x, neu.cy], "dashed", "h", 720);
  f.tag(850, neu.cy, "10%", 26, "plain");
  f.tag(850, old.cy - 80, "90%", 26, "plain");
  return f;
}

export function exampleCode(): Fig {
  const f = new Fig();
  f.codeCard(
    90,
    80,
    1820,
    `
# 示例：在机器人上异步调用 VLA 策略 (example)
import asyncio
from robot import Arm, Camera

async def control_loop(policy, hz=10):
    arm, cam = Arm("left"), Camera("wrist")
    while True:
        obs = await cam.read()          # RGB-D + proprio
        chunk = await policy.act(obs, prompt="把杯子放进篮子")
        for action in chunk:            # action chunk
            arm.send(action)
        await asyncio.sleep(1 / hz)
`,
    30,
    40,
    "control_loop.py",
  );
  return f;
}

export function exampleIo(): Fig {
  const f = new Fig();
  f.iconDoc(140, 90, 110);
  f.iconPerson(140, 260, 110);
  f.bracket(300, 70, 320, "right");
  f.arrow([300, 230], [540, 230]);
  f.bracket(560, 90, 280, "left");
  f.box(620, 130, 420, 200, "VLA 策略模型", { kind: "group" });
  f.bracket(1100, 90, 280, "right");
  f.arrow([1100, 230], [1340, 230]);
  f.iconRobotArm(1380, 170, 120);
  f.text(1540, 230, "动作 ACTION", 34, "start");
  f.text(195, 450, "指令 + 观测", 26);
  f.text(830, 450, "INPUT → MODEL → OUTPUT", 26);
  f.text(1440, 450, "机械臂", 26);
  return f;
}

export const PRIMITIVE_EXAMPLES = [
  ["a_line_area", exampleLineArea],
  ["b_bars", exampleBars],
  ["b2_formats", exampleFormats],
  ["c_table", exampleTable],
  ["d_pipeline", examplePipeline],
  ["e_fanout", exampleFanout],
  ["f_traffic", exampleTraffic],
  ["g_code", exampleCode],
  ["h_io", exampleIo],
] as const;
