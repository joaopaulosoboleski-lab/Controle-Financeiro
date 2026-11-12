@echo off
rem Inicia o PostgreSQL do projeto (porta 5434), se ainda nao estiver rodando.
"C:\Program Files\PostgreSQL\17\bin\pg_isready.exe" -h 127.0.0.1 -p 5434 >nul 2>&1 && exit /b 0
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "%USERPROFILE%\caderneta-pgdata" -l "%USERPROFILE%\caderneta-pgdata\log.txt" -o "-p 5434 -c listen_addresses=127.0.0.1" start >nul 2>&1
