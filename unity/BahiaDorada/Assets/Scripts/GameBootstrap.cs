using UnityEngine;
using UnityEngine.EventSystems;

namespace BahiaDorada
{
    // Punto de entrada: crea todo el juego al darle a Play (no hace falta montar la escena a mano).
    public class GameBootstrap : MonoBehaviour
    {
        public static GameBootstrap I;
        [Tooltip("Muestra los controles táctiles también en el editor.")]
        public bool touchControlsInEditor = false;
        Missions missions; float deadT = -1; bool busted; float trafficT;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void AutoStart()
        {
#if UNITY_2022_2_OR_NEWER
            if (FindFirstObjectByType<GameBootstrap>() == null) new GameObject("BahiaDorada").AddComponent<GameBootstrap>();
#else
            if (FindObjectOfType<GameBootstrap>() == null) new GameObject("BahiaDorada").AddComponent<GameBootstrap>();
#endif
        }

        void Start()
        {
            if (I && I != this) { Destroy(gameObject); return; }
            I = this;
            Application.targetFrameRate = 60;
            Screen.orientation = ScreenOrientation.LandscapeLeft;
            Screen.autorotateToPortrait = Screen.autorotateToPortraitUpsideDown = false;
            Screen.autorotateToLandscapeLeft = Screen.autorotateToLandscapeRight = true;
            Screen.orientation = ScreenOrientation.AutoRotation;

            foreach (var c in Camera.allCameras) if (c.CompareTag("MainCamera")) Destroy(c.gameObject);
            foreach (var l in FindObjectsOfTypeSafe()) Destroy(l.gameObject);

            City.Build();
            gameObject.AddComponent<DayNight>();
            Player.Create(City.HomeSpawn, 180f);
            Car.Spawn(City.HomeCar, City.HomeCarYaw, false, new Color(0.12f, 0.42f, 0.21f), 2);
            var camGo = new GameObject("Camara") { tag = "MainCamera" };
            camGo.AddComponent<Camera>(); camGo.AddComponent<AudioListener>(); camGo.AddComponent<CameraRig>().yaw = 180f;
            if (!FindEventSystem()) { var es = new GameObject("EventSystem"); es.AddComponent<EventSystem>(); es.AddComponent<StandaloneInputModule>(); }
            var canvas = HUD.Create();
            MobileControls.Create(canvas, touchControlsInEditor);
            Peds.Create(Application.isMobilePlatform ? 40 : 70);
            missions = gameObject.AddComponent<Missions>();
            for (int k = 0; k < 14; k++) TrafficAI.Manage(City.HomeSpawn, 20);
            if (!Application.isMobilePlatform) Cursor.lockState = CursorLockMode.Locked;
            HUD.Sub("<color=#f4d64e>Rafa:</color> Cinco años fuera y Bahía Dorada huele igual... a mar y gasolina.", 5);
        }

        static Light[] FindObjectsOfTypeSafe()
        {
#if UNITY_2022_2_OR_NEWER
            return FindObjectsByType<Light>(FindObjectsSortMode.None);
#else
            return FindObjectsOfType<Light>();
#endif
        }
        static bool FindEventSystem()
        {
#if UNITY_2022_2_OR_NEWER
            return FindFirstObjectByType<EventSystem>() != null;
#else
            return FindObjectOfType<EventSystem>() != null;
#endif
        }

        void Update()
        {
            if (!Player.I) return;
            trafficT -= Time.deltaTime;
            if (trafficT <= 0) { trafficT = 0.5f; TrafficAI.Manage(Player.I.Pos, Application.isMobilePlatform ? 14 : 22); }
            Police.Update();
            if (GameInput.PauseDown) { Time.timeScale = Time.timeScale > 0 ? 0 : 1; Cursor.lockState = Time.timeScale > 0 && !Application.isMobilePlatform ? CursorLockMode.Locked : CursorLockMode.None; HUD.Big(Time.timeScale > 0 ? "" : "PAUSA", Color.white); }
            if (deadT >= 0)
            {
                deadT += Time.deltaTime;
                if (deadT > 3.5f)
                {
                    deadT = -1; Police.Level = 0;
                    float fee = busted ? Mathf.Max(100, Player.I.money * 0.1f) : 100;
                    Player.I.AddMoney(-fee);
                    Player.I.Respawn(busted ? City.PoliceStation : City.Hospital);
                    HUD.Sub((busted ? "La fianza" : "La factura del hospital") + " te costó <color=#ff6b6b>$" + Mathf.RoundToInt(fee) + "</color>.", 4);
                }
            }
        }

        void LateUpdate() { GameInput.EndFrame(); }

        public void KnockOut(bool arrested)
        {
            if (deadT >= 0) return;
            busted = arrested; deadT = 0;
            HUD.Big(arrested ? "¡ARRESTADO!" : "¡K.O.!", arrested ? new Color(0.48f, 0.72f, 1f) : new Color(1f, 0.36f, 0.36f));
            missions.Fail(arrested ? "Te arrestaron." : "Acabaste en el hospital.");
        }
    }
}
