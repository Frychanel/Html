using UnityEngine;

namespace BahiaDorada
{
    // Entrada unificada: teclado/ratón (Input Manager clásico) + controles táctiles.
    public static class GameInput
    {
        // Estado que escriben los controles táctiles.
        public static Vector2 TouchMove;
        public static bool TGas, TBrake, TLeft, TRight, TJump, TSprint, THandbrake, THorn;
        static bool tEnter, tPunch, tTalk, tMap, tPause;
        static bool legacyOk = true;

        public static void PressEnter() => tEnter = true;
        public static void PressPunch() => tPunch = true;
        public static void PressTalk() => tTalk = true;
        public static void PressMap() => tMap = true;
        public static void PressPause() => tPause = true;

        static float Axis(string name)
        {
            if (!legacyOk) return 0f;
            try { return Input.GetAxisRaw(name); }
            catch (System.InvalidOperationException) { legacyOk = false; return 0f; }
        }
        static bool Key(KeyCode k)
        {
            if (!legacyOk) return false;
            try { return Input.GetKey(k); } catch (System.InvalidOperationException) { legacyOk = false; return false; }
        }
        static bool KeyDown(KeyCode k)
        {
            if (!legacyOk) return false;
            try { return Input.GetKeyDown(k); } catch (System.InvalidOperationException) { legacyOk = false; return false; }
        }

        public static Vector2 Move => Vector2.ClampMagnitude(new Vector2(Axis("Horizontal"), Axis("Vertical")) + TouchMove, 1f);
        public static float Steer => Mathf.Clamp(Axis("Horizontal") + (TRight ? 1 : 0) - (TLeft ? 1 : 0) + TouchMove.x, -1f, 1f);
        public static float Throttle => Mathf.Clamp(Axis("Vertical") + (TGas ? 1 : 0) - (TBrake ? 1 : 0) + TouchMove.y, -1f, 1f);
        public static bool Jump => Key(KeyCode.Space) || TJump;
        public static bool Handbrake => Key(KeyCode.Space) || THandbrake;
        public static bool Sprint => Key(KeyCode.LeftShift) || TSprint;
        public static bool Horn => Key(KeyCode.H) || THorn;
        public static bool EnterDown => KeyDown(KeyCode.F) || KeyDown(KeyCode.Return) || tEnter;
        public static bool PunchDown => KeyDown(KeyCode.Q) || tPunch || (legacyOk && Cursor.lockState == CursorLockMode.Locked && SafeMouseDown());
        public static bool TalkDown => KeyDown(KeyCode.E) || tTalk;
        public static bool MapDown => KeyDown(KeyCode.M) || tMap;
        public static bool PauseDown => KeyDown(KeyCode.P) || KeyDown(KeyCode.Escape) || tPause;

        static bool SafeMouseDown()
        {
            try { return Input.GetMouseButtonDown(0); } catch (System.InvalidOperationException) { legacyOk = false; return false; }
        }

        public static Vector2 MouseDelta
        {
            get
            {
                if (!legacyOk || Cursor.lockState != CursorLockMode.Locked) return Vector2.zero;
                return new Vector2(Axis("Mouse X"), Axis("Mouse Y"));
            }
        }

        // Se llama al final de cada frame para consumir las pulsaciones de un solo toque.
        public static void EndFrame() { tEnter = tPunch = tTalk = tMap = tPause = false; }
    }
}
