package main

import (
	"fmt"
	"github.com/gin-gonic/gin"
	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/mysql"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

/* 初始化数据库 */
var db *gorm.DB

func initMysql() (err error) {
	dsn := "root:password@(127.0.0.1:3306)/gorm?charset=utf8&parseTime=True&loc=Local"
	db, err = gorm.Open("mysql", dsn)
	if err != nil {
		return err
	}
	err = db.DB().Ping()
	return err
}

/* 数据库 */

type User struct {
	gorm.Model

	Username string `json:"username" gorm:"uniqueIndex;size:32"`
	Password string `json:"password"`
	Email    string `json:"email" gorm:"uniqueIndex"`
	PhoneNum string `json:"phone_num" gorm:"uniqueIndex"`

	Carts []Cart `gorm:"foreignKey:UserID"`
}

type Stock struct {
	gorm.Model

	Name       string    `json:"name"`
	Price      int       `json:"price"`
	Category   string    `json:"category"`
	LastUpdate time.Time `json:"last_update"`
	Picture    string    `json:"picture"`
	Info       string    `json:"info"`
	Inventory  int       `json:"inventory"`

	Carts []Cart `gorm:"foreignKey:StockID"`
}

type Cart struct {
	gorm.Model

	UserID   uint `json:"user_id" gorm:"index;uniqueIndex:idx_user_stock"`
	StockID  uint `json:"stock_id" gorm:"index;uniqueIndex:idx_user_stock"`
	Quantity int  `json:"quantity"`

	User  User  `json:"user" gorm:"foreignKey:UserID"`
	Stock Stock `json:"stock" gorm:"foreignKey:StockID"`
}

type Order struct {
	gorm.Model

	UserID uint   `json:"user_id" gorm:"index"`
	Status string `json:"status" gorm:"type:varchar(20);index"` // pending/paid/canceled

	TotalPrice int `json:"total_price"` // 单位：分

	Items []OrderItem `json:"items" gorm:"foreignKey:OrderID"`
}

type OrderItem struct {
	gorm.Model

	OrderID uint `json:"order_id" gorm:"index"`
	StockID uint `json:"stock_id" gorm:"index"`

	Name  string `json:"name"`  // 下单快照（避免商品改名影响历史订单）
	Price int    `json:"price"` // 下单快照（分）
	Qty   int    `json:"qty"`

	Stock Stock `json:"stock" gorm:"foreignKey:StockID"`
}

/* 数据加密 */

func hashPassword(password string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(b), err
}

func checkPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}

// 注册组件实现
type RegisterReq struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
	Email    string `json:"email" binding:"required"`
	PhoneNum string `json:"phone_num"`
}

func registerHandler(c *gin.Context) {
	var req RegisterReq                            //实例化注册对象
	if err := c.ShouldBindJSON(&req); err != nil { //检查是否绑定相应的信息
		c.JSON(http.StatusBadRequest, gin.H{"error": "参数错误"})
		return
	}
	hpass, err := hashPassword(req.Password) //加密密码
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "加密失败"})
		return
	}

	user := User{ //赋值
		Username: req.Username,
		Password: hpass,
		Email:    req.Email,
		PhoneNum: req.PhoneNum,
	}

	if err := db.Create(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"msg": "注册失败(可能重复)", "error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"msg": "ok",
		"user": gin.H{
			"id":        user.ID,
			"username":  user.Username,
			"email":     user.Email,
			"phone_num": user.PhoneNum,
		},
	})
}

// 登录组件
type LoginReq struct {
	Account  string `json:"account" binding:"required"`
	Password string `json:"password" binding:"required"`
}

func loginHandler(c *gin.Context) {
	var req LoginReq //初始化登录实例
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"msg": "参数错误"})
		return
	}
	var user User
	err := db.Where("username = ? OR email = ? OR phone_num = ?", req.Account, req.Account, req.Account).
		First(&user).Error
	if err != nil {
		c.JSON(401, gin.H{"msg": "账号或密码错误"})
		return
	}
	if !checkPassword(user.Password, req.Password) {
		c.JSON(401, gin.H{"msg": "账号或密码错误"})
		return
	}

	token, err := generateToken(user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"msg": "生成token失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"msg":   "ok",
		"token": token,
		"user": gin.H{
			"id":       user.ID,
			"username": user.Username,
		},
	})
}

func listProductsHandler(c *gin.Context) {
	var list []Stock
	if err := db.Order("id desc").Find(&list).Error; err != nil {
		c.JSON(500, gin.H{"msg": "查询失败"})
		return
	}
	c.JSON(http.StatusOK, list)
}

func main() {
	// 加载数据库
	err := initMysql()
	if err != nil {
		return
	}
	defer func(db *gorm.DB) {
		err := db.Close()
		if err != nil {
			panic(err)
		}
	}(db)
	// 迁移
	db.AutoMigrate(&User{}, &Stock{}, &Cart{}, &Order{}, &OrderItem{})

	// 初始化gin
	r := gin.Default()
	r.LoadHTMLGlob("template/*")
	r.Static("/static", "./static")

	// 业务逻辑
	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.tmpl", gin.H{})
	})

	r.GET("/login", func(c *gin.Context) {
		c.HTML(http.StatusOK, "login.tmpl", gin.H{})
	})

	r.GET("/register", func(c *gin.Context) {
		c.HTML(http.StatusOK, "register.tmpl", gin.H{})
	})

	r.GET("/orders", func(c *gin.Context) {
		c.HTML(http.StatusOK, "orders.tmpl", gin.H{})
	})

	r.GET("/admin", func(c *gin.Context) {
		c.HTML(http.StatusOK, "admin.tmpl", gin.H{})
	})

	// 路由组
	api := r.Group("/api")
	{
		api.POST("/register", registerHandler)
		api.POST("/login", loginHandler)
		api.GET("/products", listProductsHandler)
		api.POST("/seed", func(c *gin.Context) {
			stocks := []Stock{
				{Name: "机械键盘", Price: 399, LastUpdate: time.Now(), Category: "数码", Inventory: 20, Picture: "", Info: "冷灰极简"},
				{Name: "无线鼠标", Price: 149, LastUpdate: time.Now(), Category: "数码", Inventory: 30, Picture: "", Info: "静音微动"},
			}
			for _, s := range stocks {
				db.Create(&s)
			}
			c.JSON(200, gin.H{"msg": "ok"})
		})
	}

	auth := r.Group("/api")
	auth.Use(AuthMiddleware())
	{
		auth.GET("/me", meHandler)

		// cart
		auth.GET("/cart", getCartHandler)
		auth.POST("/cart", addCartHandler)
		auth.PUT("/cart/:id", updateCartQtyHandler)
		auth.DELETE("/cart/:id", deleteCartHandler)

		// orders
		auth.POST("/orders", createOrderHandler)
		auth.GET("/orders", listOrdersHandler)
		auth.GET("/orders/:id", getOrderDetailHandler)
		auth.POST("/orders/:id/pay", payOrderHandler)
		auth.POST("/orders/:id/cancel", cancelOrderHandler)
	}

	admin := r.Group("/api/admin")
	admin.Use(AuthMiddleware(), AdminOnly())
	{
		admin.POST("/stocks", createStockHandler)
		admin.PUT("/stocks/:id", updateStockHandler)    // 可选：编辑
		admin.DELETE("/stocks/:id", deleteStockHandler) // 可选：删除
	}

	err = r.Run(":8080")
	if err != nil {
		return
	}
}

type AddCartReq struct {
	StockID  uint `json:"stock_id" binding:"required"`
	Quantity int  `json:"quantity"`
}

func addCartHandler(c *gin.Context) {
	userID := c.GetUint("UserID")

	var req AddCartReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"msg": "参数错误"})
		return
	}
	if req.Quantity <= 0 {
		req.Quantity = 1
	}
	var stock Stock
	if err := db.First(&stock, req.StockID).Error; err != nil {
		c.JSON(404, gin.H{"msg": "商品不存在"})
		return
	}

	// 事务：避免并发时数量/库存不一致
	err := db.Transaction(func(tx *gorm.DB) error {
		var item Cart
		e := tx.Where("user_id = ? AND stock_id = ?", userID, req.StockID).First(&item).Error

		// 不存在就创建
		if e != nil {
			if gorm.IsRecordNotFoundError(e) { // gorm v1 的写法
				if req.Quantity > stock.Inventory {
					return fmt.Errorf("库存不足")
				}
				item = Cart{UserID: userID, StockID: req.StockID, Quantity: req.Quantity}
				return tx.Create(&item).Error
			}
			return e
		}

		// 已存在：合并数量 + 校验库存
		newQty := item.Quantity + req.Quantity
		if newQty > stock.Inventory {
			return fmt.Errorf("库存不足")
		}
		return tx.Model(&item).Update("quantity", newQty).Error
	})

	if err != nil {
		if err.Error() == "库存不足" {
			c.JSON(400, gin.H{"msg": "库存不足"})
			return
		}
		c.JSON(500, gin.H{"msg": "加入购物车失败", "error": err.Error()})
		return
	}

	c.JSON(200, gin.H{"msg": "ok"})
}

func getCartHandler(c *gin.Context) {
	userID := c.GetUint("userID")

	var items []Cart
	if err := db.Preload("Stock").Where("user_id = ?", userID).Order("id desc").Find(&items).Error; err != nil {
		c.JSON(500, gin.H{"msg": "查询失败"})
		return
	}
	c.JSON(200, items)
}

type updateQtyReq struct {
	Quantity int `json:"quantity"`
}

func updateCartQtyHandler(c *gin.Context) {
	userID := c.GetUint("userID")
	id := c.Param("id")
	var req updateQtyReq
	if err := c.ShouldBindJSON(&req); err != nil || req.Quantity <= 0 {
		c.JSON(400, gin.H{"msg": "参数错误"})
		return
	}

	var item Cart
	if err := db.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
		c.JSON(404, gin.H{"msg": "购物车项不存在"})
		return
	}

	// 校验库存
	var stock Stock
	if err := db.First(&stock, item.StockID).Error; err != nil {
		c.JSON(404, gin.H{"msg": "商品不存在"})
		return
	}
	if req.Quantity > stock.Inventory {
		c.JSON(400, gin.H{"msg": "库存不足"})
		return
	}

	if err := db.Model(&item).Update("quantity", req.Quantity).Error; err != nil {
		c.JSON(500, gin.H{"msg": "更新失败"})
		return
	}
	c.JSON(200, gin.H{"msg": "ok"})
}

func deleteCartHandler(c *gin.Context) {
	userID := c.GetUint("UserID")
	id := c.Param("id")

	if err := db.Where("id = ? AND user_id = ?", id, userID).Delete(&Cart{}).Error; err != nil {
		c.JSON(500, gin.H{"msg": "删除失败"})
		return
	}
	c.JSON(200, gin.H{"msg": "ok"})
}

func createOrderHandler(c *gin.Context) {
	userID := c.GetUint("UserID")

	// 1) 读购物车（必须有商品信息）
	var carts []Cart
	if err := db.Preload("Stock").Where("user_id = ?", userID).Find(&carts).Error; err != nil {
		c.JSON(500, gin.H{"msg": "读取购物车失败"})
		return
	}
	if len(carts) == 0 {
		c.JSON(400, gin.H{"msg": "购物车为空"})
		return
	}

	// 2) 开事务
	err := db.Transaction(func(tx *gorm.DB) error {
		total := 0

		// 2.1 创建订单（先创建拿到 OrderID）
		order := Order{
			UserID: userID,
			Status: "pending",
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		// 2.2 逐条处理购物车：锁库存行 -> 校验 -> 扣库存 -> 写入订单项
		for _, ci := range carts {
			if ci.Quantity <= 0 {
				return fmt.Errorf("非法数量")
			}

			// 关键：锁定该商品行，避免并发超卖
			var stock Stock
			if err := tx.Set("gorm:query_option", "FOR UPDATE").
				Where("id = ?", ci.StockID).
				First(&stock).Error; err != nil {
				return err
			}

			if ci.Quantity > stock.Inventory {
				return fmt.Errorf("库存不足: %s", stock.Name)
			}

			// 扣库存
			newInv := stock.Inventory - ci.Quantity
			if err := tx.Model(&stock).Update("inventory", newInv).Error; err != nil {
				return err
			}

			// 写入订单项（使用快照）
			item := OrderItem{
				OrderID: order.ID,
				StockID: stock.ID,
				Name:    stock.Name,
				Price:   stock.Price,
				Qty:     ci.Quantity,
			}
			if err := tx.Create(&item).Error; err != nil {
				return err
			}

			total += stock.Price * ci.Quantity
		}

		// 2.3 更新订单总价
		if err := tx.Model(&Order{}).Where("id = ?", order.ID).
			Updates(map[string]interface{}{"total_price": total}).Error; err != nil {
			return err
		}

		// 2.4 清空购物车
		if err := tx.Where("user_id = ?", userID).Delete(&Cart{}).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		// 把库存不足等错误返回给前端
		c.JSON(400, gin.H{"msg": "下单失败", "error": err.Error()})
		return
	}

	c.JSON(200, gin.H{"msg": "ok"})
}

func getOrderDetailHandler(c *gin.Context) {
	userID := c.GetUint("UserID")
	id := c.Param("id")

	var order Order
	if err := db.Preload("Items").
		Where("id = ? AND user_id = ?", id, userID).
		First(&order).Error; err != nil {
		c.JSON(404, gin.H{"msg": "订单不存在"})
		return
	}
	c.JSON(200, order)
}

func listOrdersHandler(c *gin.Context) {
	userID := c.GetUint("UserID")

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	size, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 50 {
		size = 10
	}
	offset := (page - 1) * size

	var total int
	db.Model(&Order{}).Where("user_id = ?", userID).Count(&total)

	var orders []Order
	if err := db.Where("user_id = ?", userID).
		Order("id desc").
		Limit(size).
		Offset(offset).
		Find(&orders).Error; err != nil {
		c.JSON(500, gin.H{"msg": "查询失败"})
		return
	}

	c.JSON(200, gin.H{
		"total":     total,
		"page":      page,
		"page_size": size,
		"list":      orders,
	})
}

func payOrderHandler(c *gin.Context) {
	userID := c.GetUint("UserID")
	id := c.Param("id")

	err := db.Transaction(func(tx *gorm.DB) error {
		var order Order
		if err := tx.Where("id = ? AND user_id = ?", id, userID).First(&order).Error; err != nil {
			return err
		}

		if order.Status == "paid" {
			return nil // 幂等：已支付直接成功
		}
		if order.Status != "pending" {
			return fmt.Errorf("当前状态不可支付: %s", order.Status)
		}

		return tx.Model(&order).Update("status", "paid").Error
	})

	if err != nil {
		c.JSON(400, gin.H{"msg": "支付失败", "error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"msg": "ok"})
}

func cancelOrderHandler(c *gin.Context) {
	userID := c.GetUint("UserID")
	id := c.Param("id")

	err := db.Transaction(func(tx *gorm.DB) error {
		var order Order
		if err := tx.Where("id = ? AND user_id = ?", id, userID).First(&order).Error; err != nil {
			return err
		}

		if order.Status == "canceled" {
			return nil // 幂等
		}
		if order.Status == "paid" {
			return fmt.Errorf("已支付订单不能直接取消")
		}
		if order.Status != "pending" {
			return fmt.Errorf("当前状态不可取消: %s", order.Status)
		}

		// 读订单项
		var items []OrderItem
		if err := tx.Where("order_id = ?", order.ID).Find(&items).Error; err != nil {
			return err
		}

		// 库存加回去（逐个商品行锁）
		for _, it := range items {
			var stock Stock
			if err := tx.Set("gorm:query_option", "FOR UPDATE").
				Where("id = ?", it.StockID).First(&stock).Error; err != nil {
				return err
			}

			// 回滚库存
			if err := tx.Model(&stock).Update("inventory", stock.Inventory+it.Qty).Error; err != nil {
				return err
			}
		}

		// 更新订单状态
		return tx.Model(&order).Update("status", "canceled").Error
	})

	if err != nil {
		c.JSON(400, gin.H{"msg": "取消失败", "error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"msg": "ok"})
}

func meHandler(c *gin.Context) {
	userID := c.GetUint("UserID")

	var user User
	if err := db.First(&user, userID).Error; err != nil {
		c.JSON(404, gin.H{"msg": "用户不存在"})
		return
	}

	c.JSON(200, gin.H{
		"id":       user.ID,
		"username": user.Username,
		"email":    user.Email,
	})
}

func createStockHandler(c *gin.Context) {
	name := c.PostForm("name")
	category := c.PostForm("category")
	info := c.PostForm("info")

	price, _ := strconv.Atoi(c.PostForm("price"))
	inv, _ := strconv.Atoi(c.PostForm("inventory"))

	if name == "" || price <= 0 || inv < 0 {
		c.JSON(400, gin.H{"msg": "参数错误"})
		return
	}

	picPath := ""
	file, err := c.FormFile("picture")
	if err == nil && file != nil {
		_ = os.MkdirAll("./static/uploads", 0755)
		filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
		savePath := "./static/uploads/" + filename
		if err := c.SaveUploadedFile(file, savePath); err != nil {
			c.JSON(500, gin.H{"msg": "图片保存失败", "error": err.Error()})
			return
		}
		picPath = "/static/uploads/" + filename
	}

	s := Stock{
		Name:       name,
		Price:      price,
		Category:   category,
		Info:       info,
		Inventory:  inv,
		LastUpdate: time.Now(),
		Picture:    picPath,
	}

	if err := db.Create(&s).Error; err != nil {
		c.JSON(500, gin.H{"msg": "创建商品失败", "error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"msg": "ok", "data": s})
}

func updateStockHandler(c *gin.Context) {
	id := c.Param("id")

	var s Stock
	if err := db.First(&s, id).Error; err != nil {
		c.JSON(404, gin.H{"msg": "商品不存在"})
		return
	}

	// 允许只改部分字段（简单示例）
	if v := c.PostForm("name"); v != "" {
		s.Name = v
	}
	if v := c.PostForm("category"); v != "" {
		s.Category = v
	}
	if v := c.PostForm("info"); v != "" {
		s.Info = v
	}
	if v := c.PostForm("price"); v != "" {
		if p, err := strconv.Atoi(v); err == nil && p > 0 {
			s.Price = p
		}
	}
	if v := c.PostForm("inventory"); v != "" {
		if inv, err := strconv.Atoi(v); err == nil && inv >= 0 {
			s.Inventory = inv
		}
	}

	s.LastUpdate = time.Now()

	// 可选：支持重新上传图片
	file, err := c.FormFile("picture")
	if err == nil && file != nil {
		_ = os.MkdirAll("./static/uploads", 0755)
		filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
		savePath := "./static/uploads/" + filename
		if err := c.SaveUploadedFile(file, savePath); err == nil {
			s.Picture = "/static/uploads/" + filename
		}
	}

	if err := db.Save(&s).Error; err != nil {
		c.JSON(500, gin.H{"msg": "更新失败"})
		return
	}
	c.JSON(200, gin.H{"msg": "ok", "data": s})
}

func deleteStockHandler(c *gin.Context) {
	id := c.Param("id")
	if err := db.Delete(&Stock{}, "id = ?", id).Error; err != nil {
		c.JSON(500, gin.H{"msg": "删除失败"})
		return
	}
	c.JSON(200, gin.H{"msg": "ok"})
}
