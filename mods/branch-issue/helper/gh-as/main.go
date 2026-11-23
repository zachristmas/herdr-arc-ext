// gh-as <login> <gh arguments...> runs gh as that login without switching the active
// account: the login's token goes to gh in GH_TOKEN (the environment, not the command
// line). A login gh does not know on this machine runs as the active account.
package main

import (
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strings"
)

var login = regexp.MustCompile("^[A-Za-z0-9-]{1,39}$")

func main() {
	if len(os.Args) < 3 || !login.MatchString(os.Args[1]) {
		fmt.Fprintln(os.Stderr, "usage: gh-as <login> <gh arguments...>")
		os.Exit(64)
	}
	cmd := exec.Command("gh", os.Args[2:]...)
	cmd.Stdin, cmd.Stdout, cmd.Stderr = os.Stdin, os.Stdout, os.Stderr
	if out, err := exec.Command("gh", "auth", "token", "--user", os.Args[1]).Output(); err == nil {
		if token := strings.TrimSpace(string(out)); token != "" {
			cmd.Env = append(os.Environ(), "GH_TOKEN="+token)
		}
	}
	if err := cmd.Run(); err != nil {
		if exit, ok := err.(*exec.ExitError); ok {
			os.Exit(exit.ExitCode())
		}
		fmt.Fprintln(os.Stderr, err)
		os.Exit(127)
	}
}
