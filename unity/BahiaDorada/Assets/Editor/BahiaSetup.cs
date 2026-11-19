#if UNITY_EDITOR
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace BahiaDorada.EditorTools
{
    // Menú «Bahía Dorada» en la barra superior de Unity.
    public static class BahiaSetup
    {
        const string ScenePath = "Assets/BahiaDorada.unity";

        [MenuItem("Bahía Dorada/1. Preparar proyecto")]
        public static void Setup()
        {
            Directory.CreateDirectory("Assets/Resources");
            CreateMat("BaseMat", false, false);
            CreateMat("BaseMatNormal", true, false);
            CreateMat("BaseMatEmit", false, true);
            if (!File.Exists("Assets/Resources/Sky.mat"))
            {
                var sky = new Material(Shader.Find("Skybox/Procedural"));
                AssetDatabase.CreateAsset(sky, "Assets/Resources/Sky.mat");
            }
            // Escena con el arranque del juego
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            new GameObject("BahiaDorada").AddComponent<GameBootstrap>();
            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            // Móvil: solo horizontal
            PlayerSettings.productName = "Bahía Dorada";
            PlayerSettings.companyName = "BahiaDorada";
            PlayerSettings.defaultInterfaceOrientation = UIOrientation.AutoRotation;
            PlayerSettings.allowedAutorotateToPortrait = false;
            PlayerSettings.allowedAutorotateToPortraitUpsideDown = false;
            PlayerSettings.allowedAutorotateToLandscapeLeft = true;
            PlayerSettings.allowedAutorotateToLandscapeRight = true;
            PlayerSettings.SetApplicationIdentifier(BuildTargetGroup.Android, "com.bahiadorada.juego");
            // Entrada: activar el sistema clásico además del nuevo («Both»)
            var ps = AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset");
            if (ps.Length > 0)
            {
                var so = new SerializedObject(ps[0]);
                var p = so.FindProperty("activeInputHandler");
                if (p != null) { p.intValue = 2; so.ApplyModifiedPropertiesWithoutUndo(); }
            }
            QualitySettings.shadowDistance = 140;
            AssetDatabase.SaveAssets(); AssetDatabase.Refresh();
            EditorUtility.DisplayDialog("Bahía Dorada", "Proyecto preparado.\n\nSi Unity pide reiniciar por el cambio de «Input Handling», acepta.\nDespués pulsa Play (▶) para jugar.", "OK");
        }

        static void CreateMat(string name, bool normal, bool emit)
        {
            string path = "Assets/Resources/" + name + ".mat";
            if (File.Exists(path)) return;
            var m = new Material(Shader.Find("Standard"));
            if (normal) m.EnableKeyword("_NORMALMAP");
            if (emit) { m.EnableKeyword("_EMISSION"); m.globalIlluminationFlags = MaterialGlobalIlluminationFlags.RealtimeEmissive; m.SetColor("_EmissionColor", Color.black); }
            AssetDatabase.CreateAsset(m, path);
        }

        [MenuItem("Bahía Dorada/2. Crear APK para Android")]
        public static void BuildApk()
        {
            if (!File.Exists(ScenePath)) Setup();
            Directory.CreateDirectory("Builds");
            var r = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { ScenePath }, locationPathName = "Builds/BahiaDorada.apk", target = BuildTarget.Android, options = BuildOptions.None });
            EditorUtility.DisplayDialog("Bahía Dorada", r.summary.result == UnityEditor.Build.Reporting.BuildResult.Succeeded
                ? "APK creado en la carpeta Builds/BahiaDorada.apk. Cópialo al móvil e instálalo."
                : "No se pudo crear el APK. Revisa la consola (¿está instalado «Android Build Support»?).", "OK");
        }
    }

    // Ajusta la importación de las texturas fotográficas (normales y lectura para las fachadas).
    public class BahiaTextureImport : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            if (!assetPath.Contains("Resources/Textures")) return;
            var ti = (TextureImporter)assetImporter;
            if (assetPath.Contains("_nor")) ti.textureType = TextureImporterType.NormalMap;
            if (assetPath.Contains("_diff")) { ti.isReadable = true; ti.textureCompression = TextureImporterCompression.CompressedHQ; }
            if (assetPath.Contains("_arm")) ti.sRGBTexture = false;
            ti.wrapMode = TextureWrapMode.Repeat; ti.anisoLevel = 4; ti.maxTextureSize = 1024;
        }
    }
}
#endif
