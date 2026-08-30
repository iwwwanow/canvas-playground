# Zellij не пробрасывает Kitty graphics protocol

Kitty graphics protocol (`kitty +kitten icat`) работает в голом Ghostty, но не внутри Zellij-сессии — мультиплексер перехватывает байтовый поток и escape sequences до терминала не доходят. Это фундаментальное ограничение, не баг конфигурации.

Обходной путь: открывать превью в отдельном Ghostty-окне вне Zellij — `ghostty -e kitty +kitten icat <file>`. Можно повесить на горячую клавишу в Sway. Следить за тем, когда Zellij добавит поддержку graphics protocol.
