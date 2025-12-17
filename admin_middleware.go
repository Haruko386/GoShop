package main

import (
	"github.com/gin-gonic/gin"
	"net/http"
)

func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := c.GetUint("userID") // 你 AuthMiddleware 里 Set("userID", xx)
		if uid != 1 {
			c.JSON(http.StatusForbidden, gin.H{"msg": "无权限"})
			c.Abort()
			return
		}
		c.Next()
	}
}
