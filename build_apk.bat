@echo off
set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
set "PATH=%JAVA_HOME%\bin;%PATH%"
cd /d "C:\Users\LENOVO\OneDrive\Documents\Desktop\Inspect AI\frontend\android"
call gradlew.bat assembleDebug
